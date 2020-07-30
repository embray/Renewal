"""Implements an article scraper agent using the newspaper package."""

# TODO: Perhaps we could implement additional scrapers as well, this is just
# one example.  However, all scrapers should return a scraped_article event.

from datetime import datetime, timezone
from functools import partial
from urllib import parse as urlparse

import newspaper
import tldextract

from .agent import Agent
from .utils import patch_local, truncate_dict, try_resource_update


# Extra meta tags to search for article publication date
PUBLISH_DATE_TAGS_EX = [
    {'attribute': 'name', 'value': 'DC.date.issued', 'content': 'content'}
]


# Additional XPaths to search for the site name metadata
META_SITE_NAME_EX = [
    'meta[name="application-name"]',
    'meta[name="al:android:app_name"]',
    'meta[name="al:iphone:app_name"]',
    'meta[name="al:ipad:app_name"]'
]


def _patch_newspaper():
    """
    Monkey-patch ContentExtractor.get_publishing_date to extend the set of tags
    it searches for.
    """

    # TODO: Even with this fix, a few sites simply do not put their article
    # publication date in a <meta> tag.  However, some do put it in the HTML5
    # <time> tag in the <body> of the document.  As a last resort we could also
    # look for this.

    from newspaper.extractors import ContentExtractor
    orig_get_publishing_date = ContentExtractor.get_publishing_date
    if not hasattr(orig_get_publishing_date, '__patched_local__'):
        plc = patch_local.PatchLocalConst('PUBLISH_DATE_TAGS',
                (lambda x: x + PUBLISH_DATE_TAGS_EX))
        ContentExtractor.get_publishing_date = \
                plc.patch(orig_get_publishing_date)


_patch_newspaper()


class ArticleScraper(Agent):
    def get_exchanges(self):
        return ['articles']

    async def scrape_article(self, *, resource, producer=None):
        """
        Here ``resource`` refers to the article resource.

        We use ``resource`` instead of ``article`` for consistency with other
        resource update interfaces (such as ``update_resource``) which are more
        generic.
        """

        if 'contents' not in resource:
            self.log.warning(
                f'given an article {resource} with no contents (either it '
                f'has not been crawled yet, or its crawl failed')
            return

        updates = {}

        with try_resource_update(log=self.log) as status:
            updates = self._scrape_article(resource=resource)

        self.log.info(f'scraped {resource["url"]}: status: {status}; '
                      f'updates: {truncate_dict(updates)}')

        if producer is not None:
            await producer.proxy.update_article(
                    resource=resource, type='scraped',
                    status=status, updates=updates)

        return updates

    def _scrape_article(self, *, resource):
        """
        Internal implementation of `ArticleScraper.scrape_article`.

        The outer method just handles some basic sanity check and error/status
        handling.
        """

        article_scrape = newspaper.Article(resource['url'])
        article_scrape.set_html(resource['contents'])
        article_scrape.parse()
        article_scrape.nlp()
        site_meta = self._get_site_meta(article_scrape)
        scrape = {
            'publish_date': self._get_publish_date(article_scrape),
            'title': article_scrape.title,
            'authors': article_scrape.authors,
            'summary': article_scrape.summary,
            'text': article_scrape.text,
            'image_url': article_scrape.top_image,
            'keywords': article_scrape.keywords,
        }

        # filter out keys with None value
        scrape = {k: v for k, v in scrape.items() if v is not None}
        site_meta = {k: v for k, v in site_meta.items() if v is not None}

        scrape.update({
            'site': site_meta,
            'last_scraped': datetime.utcnow()
        })

        return scrape

    async def start_scrape_article_worker(self, connection):
        producer = await self.create_producer(connection, 'articles')
        await producer.channel.set_qos(prefetch_count=1)

        worker = partial(self.scrape_article, producer=producer)
        await producer.create_worker(
                'scrape_article', worker, auto_delete=True)

    async def start_loop(self, connection):
        await self.start_scrape_article_worker(connection)

    def _get_site_meta(self, article):
        """
        Extract additional metadata about the article and its source, beyond
        what newspaper does for us by default.

        I think in the future it would be good to extend newspaper's content
        extractor with a more sophisticated one that does some of the below,
        and more.
        """

        source_url = article.source_url
        proto, url = [p.strip('/') for p in urlparse.splittype(source_url)]
        name = article.meta_site_name
        if not name:
            for xpath in META_SITE_NAME_EX:
                name = article.extractor.get_meta_content(article.clean_doc,
                                                          xpath)
                if name:
                    break
            else:
                self.log.warning(f'{article.url} did not have a meta_site_name')
                name = tldextract.extract(source_url).domain.capitalize()

        favicon = article.meta_favicon
        if favicon:
            if favicon[:2] == '//':
                # protocol-relative URL
                favicon = f'{proto}:{favicon}'
            elif favicon[0] == '/':
                # relative URL to site base
                favicon = source_url + favicon

        return {'url': url, 'name': name, 'icon_url': favicon}

    def _get_publish_date(self, article):
        """Get the article's publication date in UTC."""

        publish_date = article.publish_date
        if not publish_date:
            self.log.warning(f'{article.url} did not have a publish_date')
        else:
            publish_date = publish_date.astimezone(timezone.utc)

        return publish_date


if __name__ == '__main__':
    ArticleScraper.main()
