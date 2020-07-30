"""
Interface to the users database in firebase.

This loads users both from the firebase authentication system, as well as
loading extended user details from the firestore cloud database.
"""

from firebase_admin import auth, firestore


class _UserMeta(type):
    instances = {}
    """Maps uid to existing `User` instances."""

    def __call__(cls, uid, **kwargs):
        inst = cls.instances.get(uid)
        if inst is None:
            inst = cls.instances[uid] = super().__call__(uid, **kwargs)

        return inst


class User(metaclass=_UserMeta):
    email = None
    display_name = None
    photo_url = None

    _extended_attrs = ['birthdate', 'gender', 'location', 'settings']
    """Names of additional attributes that are stored in firestore database."""

    _collection_path = 'users'
    """Path to the users collection in the firestore database."""

    def __init__(self, uid, **kwargs):
        """
        At a minimum a user must be initialized with its UID.

        Additional user properties as retrieved from firebase are passed as
        keyword arguments.

        In order to retrieve, list, or update users in firebase, the default
        app must be initialized with `firebase_admin.initialize_app`.
        Currently this only works with the default app.
        """

        self.uid = uid
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self):
        attrs = []
        for attr in ['uid', 'email', 'display_name']:
            value = getattr(self, attr, None)
            if value is not None:
                attrs.append(f'{attr}={value!r}')

        return f'{self.__class__.__name__}({", ".join(attrs)})'

    @classmethod
    def get(cls, uid=None, email=None):
        """Get a user by UID or e-mail."""

        if uid and email:
            raise TypeError('only uid or email should be specified, not both')

        if uid is not None:
            record = auth.get_user(uid)
        elif email is not None:
            record = auth.get_user_by_email(email)
        else:
            raise TypeError('either uid or email must be specified')

        user = cls(record.uid)
        user._init_from_user_record(record)
        return user

    @classmethod
    def list(cls, limit=None, cached=False):
        """
        Returns a generator listing all users.

        If ``cached=True`` list only those users that have been cached locally,
        without contacting firebase.
        """

        idx = 0

        if cached:
            def iter_users():
                return cls.instances.values()
        else:
            def iter_users():
                user_iter = auth.list_users().iterate_all()
                for record in user_iter:
                    user = cls(record.uid)
                    user._init_from_user_record(record)
                    yield user

        for user in iter_users():
            yield user
            idx += 1
            if limit is not None and idx >= limit:
                break

    @property
    def anonymous(self):
        """
        A user is considered anonymous if they do not at least have a
        registered e-mail address.
        """

        return self.email is None

    # These are read-only for now; we don't have a strong need yet to make them
    # writeable from the backend
    @property
    def birthdate(self):
        return self._get_extended_attr('birthdate')

    @property
    def gender(self):
        return self._get_extended_attr('gender')

    @property
    def location(self):
        return self._get_extended_attr('location')

    @property
    def settings(self):
        return self._get_extended_attr('settings')

    def reload(self):
        """Reload and possibly update the user's details from firebase."""

        self._init_from_user_record(auth.get_user(self.uid))

        # Also delete extended attributes so they are re-loaded
        for attr in self._extended_attrs:
            try:
                del self.__dict__[attr]
            except KeyError:
                pass

    def _init_from_user_record(self, record):
        """Adapts a `firebase.auth.UserRecord` to the `User` class."""

        for attr in ['email', 'display_name', 'photo_url']:
            # First look the attribute up on the top-level UserRecord; if it is
            # missing, then look through the provider data in order of provider
            # (this is consistent with how the mobile app presents users)
            value = getattr(record, attr, None)
            iter_providers = iter(record.provider_data)
            while value is None:
                try:
                    value = getattr(next(iter_providers), attr, None)
                except StopIteration:
                    break

            if value is not None:
                setattr(self, attr, value)

    def _init_extended_attrs(self):
        """Load extended attrs, if any, from the firestore database."""

        db = firestore.client()
        doc = db.collection(self._collection_path).document(self.uid).get()
        for attr in self._extended_attrs:
            value = None
            if doc.exists:
                try:
                    value = doc.get(attr)
                except KeyError:
                    pass

            self.__dict__[attr] = value

    def _get_extended_attr(self, attr):
        if attr not in self.__dict__:
            # The value of the attr may be initialized to None, but if it
            # doesn't existing in the __dict__ at all that means it hasn't been
            # initialized
            self._init_extended_attrs()

        return self.__dict__[attr]
