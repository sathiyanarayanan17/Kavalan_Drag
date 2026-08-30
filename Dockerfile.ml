# ---- KAVALAN ML service ----
FROM python:3.12-slim
WORKDIR /app

COPY ml/requirements.txt ./ml/requirements.txt
RUN pip install --no-cache-dir -r ml/requirements.txt

COPY ml ./ml

# Train models at build time so the image ships ready-to-serve.
# (Comment out to mount pre-trained models via a volume instead.)
RUN python ml/train_all.py

EXPOSE 8008
CMD ["python", "ml/service.py"]
