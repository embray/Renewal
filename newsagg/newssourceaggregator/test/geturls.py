import re

if __name__ == '__main__':
    output = open("test_rss_urls.csv", 'w+')
    handle = open("./urls.csv")
    html = handle.read()
    urls = re.findall(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2})|/[\w])+', html)
    final = list(set(urls))
    for url in final:
        print(url)
        if url.endswith('.png'):
            print('REMOVED')
            final.remove(url)
    for item in final:
        output.write('en\t' + item + '\n')
