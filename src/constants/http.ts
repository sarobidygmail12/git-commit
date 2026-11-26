export const HTTP_OK = 200;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_METHOD_NOT_ALLOWED = 405;
export const HTTP_PAYLOAD_TOO_LARGE = 413;
export const HTTP_UNSUPPORTED_MEDIA_TYPE = 415;
export const HTTP_UNPROCESSABLE_CONTENT = 422;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_INTERNAL_ERROR = 500;

export const JSON_MEDIA_TYPE = "application/json";
export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
export const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
export const TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";

/** Une configuration tient en quelques Ko : 1 Mio laisse de la marge sans exposer le serveur local. */
export const MAX_REQUEST_BODY_BYTES = 1_048_576;
