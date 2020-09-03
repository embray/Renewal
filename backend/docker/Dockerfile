FROM python:3.6-slim-buster as build
# jpeg-dev needed to build Pillow
# libxml2-dev and libxslt-dev to install libxml Python wrappers
RUN apt-get update && \
    apt-get install -yqq gcc git libjpeg-dev libxml2-dev libxslt-dev libffi-dev && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
COPY requirements.txt ./
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# pip needs to be upgraded before some dependencies can be installed properly
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN pip install --editable .

FROM python:3.6-slim-buster
RUN apt-get update && \
    apt-get install -yqq libjpeg62-turbo libxml2 libcairo2 && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/venv /opt/venv
WORKDIR /usr/src/app
COPY . .
ENV PATH="/opt/venv/bin:$PATH"
# retrieve nltk data
RUN python -c 'import nltk; nltk.download("punkt")'
ENTRYPOINT [ "python", "-m" ]
