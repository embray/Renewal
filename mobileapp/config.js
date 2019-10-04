import {
    DEBUG,
    API_RENEWAL_URI,
    AUTH_FACEBOOK_APP_ID,
    AUTH_GOOGLE_ANDROID_CIENT_ID,
    AUTH_GOOGLE_IOS_CLIENT_ID,
} from 'dotenv';

const Config = {
    debug: DEBUG == "1",
    api: {
        renewalURI: API_RENEWAL_URI
    },
    auth: {
        facebook: {
            appId: FACEBOOK_APP_ID
        },
        google: {
            androidClientId: GOOGLE_ANDROID_CLIENT_ID,
            iosClientId: GOOGLE_IOS_CLIENT_ID
    }
};

export default Config;
