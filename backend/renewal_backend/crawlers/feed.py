import feedparser
from aio_pika.patterns import NackMessage

from .resource import ResourceCrawler
from ..utils import normalize_language


class FeedCrawler(ResourceCrawler):
    SOURCE_EXCHANGE = 'feeds'
    SOURCE_KEY = 'crawl_feed'
    RESULT_EXCHANGE = 'articles'

    async def crawl(self, feed, contents, result_producer=None):
        self.log.info(f'crawling {feed["type"]} feed {feed["url"]}')
        try:
            parsed = feedparser.parse(contents)
        except Exception as exc:
            self.log.warning(
                f'error parsing feed {feed["url"]}; sending '
                f'nack: {exc}')
            raise NackMessage()

        if not parsed or not parsed.get('feed'):
            # TODO: Again, also ignoring empty feeds for now
            raise NackMessage()

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


if __name__ == '__main__':
    FeedCrawler.main()