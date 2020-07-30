import feedparser

from .resource import ResourceCrawler
from ..utils import normalize_language


class FeedCrawler(ResourceCrawler):
    RESOURCE_TYPE = 'feed'
    SOURCE_EXCHANGE = 'feeds'
    SOURCE_KEY = 'crawl_feed'
    RESULT_EXCHANGE = 'articles'

    async def crawl(self, feed, contents, headers=None, result_producer=None):
        self.log.info(f'crawling {feed["type"]} feed {feed["url"]}')
        try:
            parsed = feedparser.parse(contents)
        except Exception as exc:
            self.log.warning(
                f'error parsing feed {feed["url"]}; sending '
                f'nack: {exc}')
            raise

        if not parsed or not parsed.get('feed'):
            raise ValueError('empty feed: {feed["url"]}')

        if result_producer is None:
            # Shouldn't happen
            return

        # Initial best guess at the post language.  An unfortunate
        # misfeature of RSS is that language is a feed-global
        # attribute; it does not support feeds with multiple language
        # entries.  Atom does support this in principle though not sure
        # if it's actually used.  In practice most feeds are
        # monolingual.
        lang = normalize_language(
                parsed['feed'], default=feed.get('lang', 'en'))

        for entry in parsed.get('entries', []):
            link = entry.get('link')
            if not link:
                continue

            await result_producer.proxy.save_article(
                    article={'url': link, 'lang': lang})

        return None


if __name__ == '__main__':
    FeedCrawler.main()
