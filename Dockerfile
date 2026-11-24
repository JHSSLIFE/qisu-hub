FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY index.html vite.config.ts tsconfig.json THIRD_PARTY_LICENSES.txt seed.json ./
COPY src ./src
COPY public ./public
RUN npm run check && npm run build

FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    QISUSHUO_DATA=/data
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock \
    && useradd --create-home --uid 10001 qisu \
    && mkdir /data && chown qisu:qisu /data
COPY --chown=qisu:qisu server.py seed.json ./
COPY --from=frontend --chown=qisu:qisu /build/dist ./dist
USER qisu
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ['PORT']+'/api/health',timeout=3)"
CMD ["python", "server.py"]
