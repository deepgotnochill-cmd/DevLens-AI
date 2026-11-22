FROM python:3.13-slim
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home devlens
COPY api api
USER devlens
CMD ["uvicorn","api.main:app","--host","0.0.0.0","--port","8000","--no-proxy-headers"]

