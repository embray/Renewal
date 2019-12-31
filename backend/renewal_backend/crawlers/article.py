from .resource import ResourceCrawler


class ArticleCrawlwer(ResourceCrawler):
    SOURCE_EXCHANGE = 'articles'
    SOURCE_KEY = 'crawl_article'
