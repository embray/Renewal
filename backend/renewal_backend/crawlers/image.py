"""
Crawler which saves image data from articles and sites.

Currently just used to scrape site logos.
"""


from .resource import ResourceCrawler


class ImageCrawler(ResourceCrawler):
    RESOURCE_TYPE = 'image'
    SOURCE_EXCHANGE = 'images'
    SOURCE_KEY = 'crawl_image'
    CONTENT_TYPE = 'binary'

    async def crawl(self, image, contents, result_producer=None):
        """
        Currently just returns the contents of the article and does not do
        any further crawling for links.
        """

        self.log.info(f'crawling image {image["url"]}')
        # An image 'crawled' resource update message will be sent, along with
        # the article contents; see ResourceCrawler.crawl_resource
        return {'contents': contents}


if __name__ == '__main__':
    ImageCrawler.main()
