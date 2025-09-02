# Docker Deployment für Uniswap Routing API (Sepolia Only)

Diese Anleitung zeigt, wie Sie die Uniswap Routing API in einem Docker Container betreiben können.

## Voraussetzungen

- Docker installiert
- Docker Compose installiert (optional, aber empfohlen)

## Schnellstart mit Docker Compose

1. **Repository klonen** (falls noch nicht geschehen)
2. **Environment-Variablen anpassen** in `docker-compose.yml`
3. **Container starten:**

```bash
docker-compose up -d
```

Die API ist dann unter `http://localhost:8080` erreichbar.

## Manuelle Docker-Befehle

### Build

```bash
docker build -t uniswap-routing-api-sepolia .
```

### Run

```bash
docker run -d \
  --name routing-api \
  -p 8080:8080 \
  -e WEB3_RPC_11155111=https://rpc.sepolia.org \
  uniswap-routing-api-sepolia
```

## Konfiguration

### Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `WEB3_RPC_11155111` | Sepolia RPC Endpoint | `https://rpc.sepolia.org` |
| `PORT` | Server Port | `8080` |
| `NODE_ENV` | Node.js Environment | `production` |
| `THROTTLE_PER_FIVE_MINS` | Rate Limiting | `100` |

### RPC Provider

**Kostenlose Optionen:**
- `https://rpc.sepolia.org` (Standard)
- `https://sepolia.infura.io/v3/YOUR_KEY`
- `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`

**Empfehlung:** Verwenden Sie einen eigenen RPC-Schlüssel für bessere Performance und Zuverlässigkeit.

## API Endpoints

- **Health Check:** `GET /health`
- **Quote:** `GET /quote?tokenInAddress=...&tokenInChainId=11155111&...`

### Beispiel-Request

```bash
curl "http://localhost:8080/quote?tokenInAddress=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14&tokenInChainId=11155111&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=11155111&amount=1000000000000000000&type=exactIn"
```

## Container-Management

### Status prüfen
```bash
docker-compose ps
docker-compose logs -f routing-api
```

### Container stoppen
```bash
docker-compose down
```

### Neustart
```bash
docker-compose restart routing-api
```

### Container-Shell
```bash
docker-compose exec routing-api sh
```

## Health Monitoring

Der Container hat eingebaute Health Checks:

```bash
# Health Check Status
docker inspect --format='{{.State.Health.Status}}' routing-api

# Health Check Logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' routing-api
```

## Logs

Logs werden in das `/app/logs` Verzeichnis im Container geschrieben und können über Docker Volumes gemounted werden.

```bash
# Live Logs
docker-compose logs -f routing-api

# Logs exportieren
docker cp routing-api:/app/logs ./logs
```

## Troubleshooting

### Häufige Probleme

1. **Port bereits belegt:**
   ```bash
   # Port in docker-compose.yml ändern
   ports:
     - "8081:8080"
   ```

2. **RPC Verbindungsfehler:**
   - RPC URL überprüfen
   - API-Schlüssel validieren
   - Netzwerk-Konnektivität testen

3. **Container startet nicht:**
   ```bash
   docker-compose logs routing-api
   ```

### Performance Tuning

Für bessere Performance:

```yaml
services:
  routing-api:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

## Sicherheit

- Container läuft als Non-Root User
- Nur notwendige Ports exponiert
- Keine sensiblen Daten im Image
- Health Checks für Monitoring

## Production Deployment

Für Production-Umgebungen:

1. **Environment-Variablen sicher verwalten**
2. **Reverse Proxy (nginx) vorschalten**
3. **SSL/TLS Terminierung**
4. **Monitoring und Logging einrichten**
5. **Backup-Strategie für Konfiguration**