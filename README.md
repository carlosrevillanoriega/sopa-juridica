# Sopa Jurídica

Sopa de letras multijugador en tiempo real para clase (tema: Derecho).

- `/` — jugadores: nickname + avatar de abogado con sombrero, sopa de letras (mismas palabras, posiciones distintas por jugador).
- `/tablero` — tablero en vivo para proyectar: jugadores, progreso, podio, QR del juego y QR del WiFi, editor de palabras y "Nueva ronda".

Tiempo real vía MQTT sobre WebSocket (broker público EMQX, sin servidor propio). Parámetros:
- `?sala=nombre` separa grupos.
- `?b=hivemq` usa broker alterno si la red bloquea EMQX.
- En el tablero: `?ssid=Red&pass=Clave` precarga el WiFi.

Sitio 100% estático; despliega directo en Vercel.
