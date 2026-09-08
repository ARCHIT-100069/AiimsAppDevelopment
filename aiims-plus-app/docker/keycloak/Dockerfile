# Keycloak service for hosted demo deploys (Render). Mirrors docker-compose.yml's
# local dev setup but binds to $PORT and trusts the platform's TLS-terminating
# proxy. Realm import happens post-boot via the Admin API (see
# scripts/import-realm-remote.py), not --import-realm at startup: on a 512Mi
# container the bulk import spiked memory past the limit every time during
# boot; the same import against a warm, idle server does not.
FROM quay.io/keycloak/keycloak:26.4

ENV KC_HTTP_ENABLED=true
ENV KC_HOSTNAME_STRICT=false
ENV KC_PROXY_HEADERS=xforwarded
ENV KC_HEALTH_ENABLED=false
ENV KC_METRICS_ENABLED=false
# Single instance — the default clustered cache (Infinispan/JGroups) spends
# real memory discovering peers that don't exist; run local-only caches.
ENV KC_CACHE=local
# Render's free/starter web-service plan caps the container at 512Mi. `start-dev`
# re-augments (rebuilds) the server on every boot, which spikes well past that —
# pre-build the optimized server at image-build time instead, then start it
# directly (`start --optimized`) so boot only starts an already-built server.
RUN /opt/keycloak/bin/kc.sh build
ENV JAVA_OPTS_APPEND="-Xms64m -Xmx300m -XX:MetaspaceSize=64m -XX:MaxMetaspaceSize=200m"

ENTRYPOINT ["/bin/sh", "-c", "/opt/keycloak/bin/kc.sh start --optimized --hostname-strict=false --http-host=0.0.0.0 --http-port=${PORT:-8080}"]
