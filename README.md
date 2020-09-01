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
