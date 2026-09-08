# Keycloak service for hosted demo deploys (Render). Mirrors docker-compose.yml's
# local dev setup (start-dev --import-realm against docker/keycloak/realm-aiims.json)
# but binds to $PORT and trusts the platform's TLS-terminating proxy.
FROM quay.io/keycloak/keycloak:26.4

COPY realm-aiims.json /opt/keycloak/data/import/realm-aiims.json

ENV KC_HTTP_ENABLED=true
ENV KC_HOSTNAME_STRICT=false
ENV KC_PROXY_HEADERS=xforwarded
ENV KC_HEALTH_ENABLED=true

ENTRYPOINT ["/bin/sh", "-c", "/opt/keycloak/bin/kc.sh start-dev --import-realm --http-port=${PORT:-8080}"]
