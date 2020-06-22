from .resource import ResourceCrawler


class ArticleCrawler(ResourceCrawler):
    RESOURCE_TYPE = 'article'
    SOURCE_EXCHANGE = 'articles'
    SOURCE_KEY = 'crawl_article'

    async def crawl(self, article, contents, result_producer=None):
        """
        Currently just returns the contents of the article and does not do
        any further crawling for links.
        """

        self.log.info(f'crawling article {article["url"]}')
        # An article 'crawled' resource update message will be sent, along with
        # the article contents; see ResourceCrawler.crawl_resource
        return {'contents': contents}


if __name__ == '__main__':
    ArticleCrawler.main()
