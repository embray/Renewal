import {
    DEBUG,
    API_RENEWAL_URI,
    AUTH_FACEBOOK_APP_ID,
    AUTH_GOOGLE_ANDROID_CLIENT_ID,
    AUTH_GOOGLE_IOS_CLIENT_ID,
} from 'dotenv';

const Config = {
    debug: DEBUG == "1",
    api: {
        renewalURI: API_RENEWAL_URI
    },
    auth: {
        facebook: {
            appId: AUTH_FACEBOOK_APP_ID
        },
        google: {
            androidClientId: AUTH_GOOGLE_ANDROID_CLIENT_ID,
            iosClientId: AUTH_GOOGLE_IOS_CLIENT_ID
        }
    }
};

export default Config;
