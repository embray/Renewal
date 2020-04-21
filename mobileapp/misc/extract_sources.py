"""
One-off script that was used to create a dummy 'source' database from a list
of dummy article data.

The article data used was originally hard-coded in the JavaScript for the
mobile app, in the variables beginning at:

https://github.com/RenewalResearch/Renewal/blob/44f385cb4a6702aa114e81b0a3df7399223a09a1/mobileapp/src/containers/ListOfArticles/DiverseRecommendation.js#L21

This was extracted into a JSON file and cleaned up.  This script was then use
to generate the fake "database" of article sources, and to add a little more
information to the article data themselves (namely their publication date where
possible).

Neither of these JSON files currently reflect what the final format will be for
articles and sources downloaded from the Renewal web server; however once that
format is decided these dummy databases should be updated to reflect it.
"""


import argparse
import base64
import json
import warnings
import sys
from datetime import timezone
from urllib import parse as urlparse

import newspaper
import requests
import tqdm

# This is needed because newspaper does not otherwise make it very easy to add
# additional <meta> tags to look for the publication date in.
import patch_local


# At least a couple sites restrict scrapers, so for simplicity's sake
# we'll be bad and spoof the User-Agent; in practice we should be better
# about detecting this and make a log of what sites require permission
# for scraping.
FAKE_USER_AGENT = ('Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:75.0) '
                   'Gecko/20100101 Firefox/75.0')

# Extra meta tags to search for article publication date
PUBLISH_DATE_TAGS_EX = [
    {'attribute': 'name', 'value': 'DC.date.issued', 'content': 'content'}
]


# Additional XPaths to search for the site name metadata
META_SITE_NAME_EX = ['meta[name="application-name"]']


def get_source_meta(article):
    """
    Extract additional metadata about the article and its source, beyond
    what newspaper does for us by default.

    I think in the future it would be good to extend newspaper's content
    extractor with a more sophisticated one that does some of the below,
    and more.
    """

    source_url = article.source_url
    key = urlparse.splittype(source_url)[1].strip('/')
    name = article.meta_site_name
    if not name:
        for xpath in META_SITE_NAME_EX:
            name = article.extractor.get_meta_content(article.clean_doc, xpath)
            if name:
                break
        else:
            warnings.warn(f'{article.url} did not have a meta_site_name')
            name = tldextract.extract(source_url).domain.capitalize()
    publish_date = article.publish_date
    if not publish_date:
        warnings.warn(f'{article.url} did not have a publish_date')
    else:
        publish_date = publish_date.astimezone(timezone.utc).isoformat()
    favicon = article.meta_favicon
    if favicon and favicon[0] == '/':
        # relative URL to site base
        favicon = source_url + favicon
    return (key, name, publish_date, favicon)


def patch_newspaper():
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


def download(url):
    headers = {'User-Agent': FAKE_USER_AGENT}
    try:
        return requests.get(url, headers=headers)
    except Exception as exc:
        warnings.warn(f'failed to download {url}: {exc}')


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('articles',
            help='path to the input articles JSON file; note: this file will '
                 'be rewritten by this program')
    parser.add_argument('sources',
            help='path to output the generated sources JSON file')

    args = parser.parse_args()

    patch_newspaper()

    with open(args.articles) as fobj:
        articles = json.load(fobj)

    sources = {}

    with tqdm.tqdm(articles, unit='page') as bar:
        for article_ in bar:
            url = article_['url']
            article = newspaper.Article(url)
            # Use requests to download the article HTML
            # so that we have more control over headers, etc.
            r = download(url)
            if r is None:
                continue
            article.set_html(r.text)
            article.parse()
            s_key, s_name, s_publish_date, s_icon = get_source_meta(article)
            article_['source'] = s_key
            if s_publish_date:
                article_['date'] = s_publish_date
            sources.setdefault(s_key, {'name': s_name})
            if s_icon and 'icon' not in sources[s_key]:
                r = download(s_icon)
                if r is None:
                    warnings.warn(f'error retriving icon for {s_key}')
                else:
                    icon = base64.b64encode(r.content).decode('ascii')
                    sources[s_key]['icon'] = icon

    with open(args.articles, 'w') as fobj:
        json.dump(articles, fobj, indent=2, ensure_ascii=False)

    with open(args.sources, 'w') as fobj:
        json.dump(sources, fobj, indent=2, ensure_ascii=False)

if __name__ == '__main__':
    sys.exit(main())
