FROM python:3.6-slim-buster
WORKDIR /usr/src/app
COPY requirements.txt ./
# pip needs to be upgraded before some dependencies can be installed properly
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD [ "python", "baseline.py" ]
