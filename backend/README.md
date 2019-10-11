Renewal Backend Services
========================

This package implements multiple backend services for the Renewal system
backend, including crawler and scraper agents, a main coordinator, and (for
now) the HTTP API as well.

Keeping all services in a single package will, for now, keep development
easier, and deployment of an individual service is just a matter of
installing this package and its depenencies, and starting just that service.
Each service will be implemented as a sub-module or package and will have
`main()` functions that can be started by running:

    $ python -m renewal_backend.<name_of_service>

(or by some other mechanism in some cases; e.g. the HTTP API app can be run
as a WSGI app, etc.)

This serves as a replacement for the old backend code currently under the
`newsagg/` directory in this repository, which will remain for now for
reference but later be removed.
