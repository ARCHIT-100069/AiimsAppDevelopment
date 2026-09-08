# Keycloak service for hosted demo deploys (Render). Mirrors docker-compose.yml's
# local dev setup (start-dev --import-realm against docker/keycloak/realm-aiims.json)
# but binds to $PORT and trusts the platform's TLS-terminating proxy.
FROM quay.io/keycloak/keycloak:26.4

COPY realm-aiims.json /opt/keycloak/data/import/realm-aiims.json

ENV KC_HTTP_ENABLED=true
ENV KC_HOSTNAME_STRICT=false
ENV KC_PROXY_HEADERS=xforwarded
ENV KC_HEALTH_ENABLED=false
ENV KC_METRICS_ENABLED=false
# Render's free/starter web-service plan caps the container at 512Mi. start-dev's
# JVM defaults assume much more; cap heap explicitly so the container survives.
ENV JAVA_OPTS_APPEND="-Xms64m -Xmx300m -XX:MetaspaceSize=64m -XX:MaxMetaspaceSize=200m"

ENTRYPOINT ["/bin/sh", "-c", "/opt/keycloak/bin/kc.sh start-dev --import-realm --http-port=${PORT:-8080}"]
