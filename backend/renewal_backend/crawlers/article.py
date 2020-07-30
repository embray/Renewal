import copy

from .resource import ResourceCrawler


class ArticleCrawler(ResourceCrawler):
    RESOURCE_TYPE = 'article'
    SOURCE_EXCHANGE = 'articles'
    SOURCE_KEY = 'crawl_article'
    RESULT_EXCHANGE = 'articles'

    async def crawl(self, article, contents, headers=None,
                    result_producer=None):
        """
        Currently just returns the contents of the article and does not do
        any further crawling for links.
        """

        url = article['url']
        self.log.info(f'crawling article {url}')

        if result_producer is not None:
            # Send the article to be scraped (only for its canonical URL)
            article = copy.copy(article)
            article['url'] = article['canonical_url']
            article['contents'] = contents
            await result_producer.proxy.scrape_article(resource=article)

        # An article 'crawled' resource update message will be sent, along with
        # the article contents; see ResourceCrawler.crawl_resource
        return {'contents': contents}


if __name__ == '__main__':
    ArticleCrawler.main()
