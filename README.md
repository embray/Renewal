# Renewal - A real-time evaluation platform for news recommender systems

News recommendation is a specific task in the area of recommender systems
because of both the nature of items (news volatility, dynamic popularity,
textual content, etc.) and the need to evaluate recommendation algorithms in
real-time. Challenges are a fun way to stimulate research. We propose a
platform called Renewal to host a news recommendation challenge. The
platform provides the evaluation service for contenders programs submitted
by research teams. To our knowledge, this platform is the only one which
offers a user application fully dedicated to the cross-website and
cross-language news articles recommendation task. It also offers a large
panel of context / demographic clues and a long-term user history through a
dedicated mobile app.


[![Renewal gource visualization (2018
work)](https://img.youtube.com/vi/VID/0.jpg)](https://www.youtube.com/watch?v=0rSm4hqPUJE)


## Top-level layout

* `backend/` - all backend services (with the exception of recommendation
  systems)
* `mobileapp/` - the Renewal mobile app
* `recsystems/` - baseline recommendation system and/or recommendation
  system templates (this might later be moved to a separate repository
  so that challenge participants can easily fork it to start their own
  systems)
* `website/` - currently empty; might later contain sources for a static
  website for the project

All of the backend services are written in Python, while the mobile app is
written in JavaScript using [React Native](https://reactnative.dev/) and
[Expo](https://expo.io/).  Thus the two sub-projects do not share any code,
although they are linked in that the app must be kept up-to-date with the
backend's RESTful API and data structures for users, articles, etc.


## Development setup

The following documents how to set up development of both the mobile app and
the backend, as well as associated external services
([Firebase](https://firebase.google.com/), Google integrations, etc.
Additional details for staging/production deployment will be documented
separately.


### Firebase

If you just want to get started on development of the mobile app, Firebase
setup can be skipped initially, as the app can run in a limited development
mode which does not require access to the backend or to Firebase.  This mode
is very restricted, however, and will not allow most functionality.  It is
mostly only useful for testing UI components and the like.

Many of the backend services can also work without access to Firebase.

In particular, at the moment we only use Firebase for managing user
authentication and the user database.  Any services that don't require
knowledge of users (e.g. crawlers) can be worked on without setting up a
Firebase project.

Nevertheless, it is required for testing the full functionality of the app
and the backend, so going through these steps is recommended.

1. Log into the [Firebase
   Console](https://console.firebase.google.com)--this will require signing in
   with a Google account.

2. Create a new project using the free tier.  You can name the project
   whatever you want (something liked "renewal-dev", although that name is
   already taken for the official dev project; in this case Firebase will
   offer an alternative name with a random string appended as a unique
   identifier).

3. For development purposes you can disable Google Analytics.

The next step is to add "apps" to the project--Firebase allows configuring
multiple types of apps (Android, iOS, web, etc.) which all use the same
project on their backend, but require different configuration settings due
to the disparate nature of their target platforms.

#### Android

1. Under "Get started by adding Firebase to your app" click "Android".

2. For now you can name the package name anything you want, like
   "com.renewal-system.dev".

3. Following the suggestion, download the `google-services.json` config
   file.  You can save it wherever you want, but as it will be used for
   the mobile app, it is recommended to save it in the `mobileapp/`
   directory of the repository.  This file is already configured to be
   ignored by git, but do not add it to the git repository.  We will use
   this later when configuring the mobile app.

4. Since we're using Expo it is not necessary to download the gradle build
   files (these are for native Android development).

#### iOS

TODO

#### Web

Despite the name, a "web" app is used for interfacing with Firebase via its
[JavaScript SDK](https://firebase.google.com/docs/reference/js).  We use
this in the mobile app due to
[limitations](https://docs.expo.io/guides/using-firebase/) in using the
native Firebase SDKs with Expo.

1. Click the `+ Add App` button and add a Web app.

2. You can give the app any nickname you want, like "renewal-dev-js-sdk".
   It is not necessary to set up Firebase Hosting.

3. Don't bother copying the HTML snippet it outputs.  We will not be using
   this since we're currently using it in the mobile app, not a website.
   We'll come back to this when configuring the mobile app (the
   `firebaseConfig` it outputs can be retrieved at a later time).

#### Service account

A service account is needed for administrative access to Firebase from the
backend.  This is created for you automatically, but we need to download the
private key for the account.

1. From the gear icon on the left-side bar select "Project settings", then
   the "Service accounts" tab.

2. We are using the "Firebase Admin SDK" service account (selected by
   default).  Click the "Generate new private key" button.

3. You will be prompted to download a JSON file containing the private key,
   among other metadata.  You can save this file wherever you want, though
   since it will be used by the backend you can save it in the `backend/`
   directory.  However, **DO NOT COMMIT THIS FILE TO THE GIT REPOSITORY**.

4. In the sample "Admin SDK configuration snippet" make note of the
   "databaseURL" setting.  We will use this later.  However, it is always
   simply in the form `https://<project-name>.firebaseio.com`.

#### Authentication

Currently three authentication methods are supported: anonymous,
e-mail/password, and Google.  Others will be added later.  Of this, only
anonymous is absolutely required, though adding other methods provides a
better user experience (e.g. syncing across devices).

1. From the left-side bar select "Authentication".

2. Click "Set up sign-in method".

3. Click on "Anonymous" (at the bottom of the list) and enable it.

4. (Optional) Click on "Email/Password" and enable it.  We don't currently
   use the "Email link" option.

5. (Optional) Click on "Google" and enable it.  For Project public-facing
   name you can keep the randomized default, or set it something else.
   However, these names are globally unique so don't use something like
   "Renewal".  For "Project support email" just select your own e-mail
   address.  The other details can be left alone for now.

#### Firestore

A Firestore database is used to store additional user information not stored
by the authentication system (additional user metadata, as well as their app
settings).

1. From the left-side bar select "Cloud Firestore".

2. Click the "Create database" button.

3. You can select either "Start in production mode" or "Start in test
   mode"--this selection only affects the default access rules for the
   database.  For development, "test mode" is most convenient, though we
   will update the security rules later.

4. Select a "Cloud Firestore location" that is conveniently local to you.

5. TODO: Configure the access control rules.

### Backend

TODO: Finish architecture diagram.

The Renewal backend is built on a microservice architecture, with services
communicating over the [RabbitMQ](https://www.rabbitmq.com/) message broker
services.  As documented in the above diagram, it currently consists of the
following services (listed by the Python module that implements them):

* `renewal_backend.controller`--this is the central orchestrator of the
  backend.  It is responsible for managing feeds, scheduling crawling of
  feeds and articles, inserting results from the crawlers and scrapers into
  the database, managing user assignments to recommendation systems, among
  other tasks.  The present design assumes only one controller will ever be
  running at a given time.

* `renewal_backend.crawlers.feed`--this is the feed crawler service
  responsible for downloading and parsing data from feeds (currently only
  RSS feeds but other types will be added) and producing links to new
  articles from those feeds.

* `renewal_backend.crawlers.article`--this is the article crawler service;
  at present it mostly just downloads the raw contents of individual
  articles that are discovered by the feed crawlers.  Parsing of the article
  contents is handled by the scraper service.

* `renewal_backend.crawlers.image`--this is the image crawler service;
  it is responsible for downloading all images that are cached by the
  backend.  At present it is only used for downloading news site icons that
  are displayed to the user by the app, though in the future it may also be
  used to cache article images.

* `renewal_backend.scraper`--this is the article scraper service.  At
  present there is only one article scraper implementation based on
  [newspaper3k](https://newspaper.readthedocs.io/en/latest/) though others
  may be added later.  This parses the raw contents of crawled articles and
  produces additional article metadata such as the article title,
  publication date, top image, summary, etc.  Currently most of this
  information is not used directly by the system, but may be used by
  recommendation systems to improve their predictions.

* `renewal_backend.web`--implements the HTTP API which consists of a RESTful
  API and a Websocket API.  The REST interface is used both by the mobile
  app and by recommendation systems, while the Websocket API is how
  recommendation systems communicate with the backend.

* recommendation systems (recsystems)--the other services needed for the
  backend to function are the recommendation systems themselves, which are
  currently not part of the `renewal_backend` package (TODO: It might be good
  to add the baseline recsystem to the standard package as it is necessary to
  have at least one recsystem).  With the exception of one or more baseline
  recsystems run on the backend, all other recsystems will be provided
  externally by challenge participants.

With the exception of the Controller, which is currently designed to be run
as a single instance, all other services can be run in any number of
instances to allow load balancing.  This includes the web server, though
balancing of the web service will require an additional load-balancing
proxy, which is not documented here (that will be documented as part of the
production deployment documentation).


#### Backend configuration

All of the backend services are configured via a single config file, named
`renewal.yaml` by default.  Each service can also take an alternative path
to the config file as a command-line argument.

The default configuration can be found in the file
`renewal_backend/config.py` and is mostly sufficient for a development/test
deployment.  However, there are a few settings that need to be specified
manually by writing a `renewal.yaml`.  At present these are:

```yaml
web:
    firebase:
        project_id: <firebase-project-id>
        service_account_key_file: <path-to-service-account-file.json>
        app_options:
            databaseURL: https://<firebase-project-id>.firebaseio.com
```

All of these settings were obtained from the Firebase configuration in the
previous section.  The `web.firebase.service_account_key_file` should be the
name of the private key JSON file downloaded in the "Service account"
section of the Firebase configuration.  To give a more concrete example:

```yaml
web:
    firebase:
        project_id: renewal-dev
        service_account_key_file: renewal-dev-firebase-adminsdk-xxxxx-xxxxxxxxxx.json
        app_options:
            databaseURL: https://renewal-dev.firebaseio.com
```

The default configuration also assumes MongoDB and RabbitMQ running on
localhost on the default ports and the default security settings.


#### Running services

To run individual backend services manually, it is necessary to first
install the `renewal_backend` Python package and its dependencies.  The
following assumes you are in the `backend/` directory.

It is a good idea to create a virtual environment or Conda environment for
this purpose.  Note: The minimum Python version is 3.6.  For example:

```bash
$ mkdir ~/.virtualenvs
$ python3.6 -m venv ~/.virtualenvs/renewal
$ source ~/.virtualenvs/renewal/bin/activate
```

To install the dependencies run:

```bash
$ pip install -r requirements.txt
```

Then install the package.  For development it is useful to install it in
"editable" mode:

```bash
$ pip install -e .
```

Individual services can be started by running:

```bash
$ python -m renewal_backend.<service_name>
```

For example,

```bash
$ python -m renewal_backend.controller
```

Although each service can be run individually, it is of course necessary to
start all services in order for the system to be fully functioning.  This
can be a hassle when starting services manually, so a
[docker-compose](https://docs.docker.com/compose/) file is provided for
starting up all or some of the services (see the next section).  However,
it can still be useful to start individual services manually for testing and
debugging.


#### Running with Docker

The `backend/docker` directory contains a `Dockerfile` for building an image
appropriate for running all of the backend services, as well as a
`docker-compose.yml` file to quickly get a minimal set of all services up
and running, including at least one (more can be added later) baseline
recommendation system.

There are a couple of prerequisites to complete before starting the
docker-compose file:

* All [Firebase](#firebase) configuration should be completed.
* There should be an existing [`renewal.yaml`](#backend-configuration) file
  in the `backend/` directory with the correct configuration filled in based
  on the Firebase configuration.

Then to build the images and start the service containers, run (from the
`backend/` directory):

```bash
$ docker-compose -p renewal -f docker/docker-compose.yml up
```

Here the `-p renewal` flag sets the "project name" to "renewal".  Otherwise
`docker-compose` takes the default project name from the name of the
directory the `docker-compose.yml` file is in, which in this case will be
just "docker", which is rather unclear.

The `docker-compose.yml` mounts the backend source directory as a volume
inside the containers it launches, e.g. like `--volume ..:/usr/src/app`
(it uses `..` because this is relative to the location of
`docker-compose.yml`).  This means that when the services start they will
read your local `renewal.yaml` file.  It's also a convenient way to test
changes to the sources.

For example, say you make some edits to `renewal_backend/controller.py`.
You can then restart the controller service by running:

```bash
$ docker-compose -p renewal -f docker/docker-compose.yml restart controller
```

The controller service will restart and your code changes are immediately
reflected without having to rebuild the service.

To speed things up, you can avoid some of the extra `docker-compose` flags
as follows:

* Create a [`.env`](https://docs.docker.com/compose/environment-variables/#the-env-file)
  file in the `docker/` directory like:
  `echo 'COMPOSE_PROJECT_NAME=renewal' > docker/.env`

* Run `cd docker/` so that you're already in the `docker/` directory.  By
  default `docker-compose` looks for a `docker-compose.yml` file in the
  current directory.  So now you can just run, for example:
  `docker-compose restart controller` without any additional flags.
