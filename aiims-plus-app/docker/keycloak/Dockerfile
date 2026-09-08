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
# Render's free/starter web-service plan caps the container at 512Mi. `start-dev`
# re-augments (rebuilds) the server on every boot, which spikes well past that —
# pre-build the optimized server at image-build time instead, then start it
# directly (`start --optimized`) so boot only starts an already-built server.
RUN /opt/keycloak/bin/kc.sh build
ENV JAVA_OPTS_APPEND="-Xms64m -Xmx300m -XX:MetaspaceSize=64m -XX:MaxMetaspaceSize=200m"

ENTRYPOINT ["/bin/sh", "-c", "/opt/keycloak/bin/kc.sh start --optimized --import-realm --hostname-strict=false --http-port=${PORT:-8080}"]
