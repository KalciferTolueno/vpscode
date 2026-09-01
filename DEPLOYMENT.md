# VPS Code v1.4: despliegue con Compose

Esta es la guía de despliegue para la rama `v1.4`, la versión más actualizada de VPS Code.

VPS Code se despliega mediante la opción **Compose/Composer de EasyPanel**. No se debe configurar como una aplicación estática ni ejecutar únicamente el frontend: el contenedor compila y ejecuta el servidor completo de VPS Code.

## Componentes

- `Dockerfile`: compila el binario y crea la imagen de ejecución.
- `docker-compose.yml`: define el servicio, sus variables y los volúmenes persistentes.
- Servicio Compose: `vpscode`.
- Puerto interno HTTP: `4096`.
- Proceso: `opencode serve --hostname 0.0.0.0 --port 4096`.
- Directorio de trabajo: `/workspace`.

## Funciones de v1.4

- Interfaz web con marca VPS Code y fondo dither en el layout.
- Chats, configuración y proyectos persistentes.
- Navegador integrado para previsualizar aplicaciones del proyecto.
- Proxy interno para servidores de desarrollo mediante `/preview/<puerto>/`.
- Reescritura automática de rutas absolutas de Vite (`/src/...`, `/@vite/client`) para que el preview funcione sin `--base`.
- Redirección del WebSocket HMR de Vite a través del mismo origen.
- Selector visual de elementos del navegador.
- Consola integrada con errores de JavaScript, promesas y recursos.
- Acción para añadir los errores capturados al prompt del agente.
- Herramientas de depuración ocultas en builds de producción.

## Variables

EasyPanel debe definir estas variables antes de desplegar:

| Variable | Obligatoria | Valor recomendado | Descripción |
| --- | --- | --- | --- |
| `OPENCODE_SERVER_PASSWORD` | Sí | Una contraseña segura | Contraseña de acceso HTTP Basic. |
| `OPENCODE_SERVER_USERNAME` | No | `opencode` | Usuario de acceso; `opencode` es el valor predeterminado. |
| `OPENCODE_DISABLE_EMBEDDED_WEB_UI` | No | `false` | El Compose ya fija `false` para servir la interfaz de VPS Code. |

No se deben guardar contraseñas directamente en `docker-compose.yml` ni en Git.

## Ejecución con Docker Compose

Fuera de EasyPanel, la misma versión puede ejecutarse con Docker Compose:

```bash
export OPENCODE_SERVER_PASSWORD='cambia-esta-clave'
docker compose up -d --build
docker compose logs -f vpscode
```

Para detener el servicio sin borrar los datos:

```bash
docker compose down
```

No uses `docker compose down -v` salvo que quieras eliminar también los volúmenes persistentes.

## Datos persistentes

El Compose crea tres volúmenes nombrados:

| Volumen | Ruta del contenedor | Contenido |
| --- | --- | --- |
| `vpscode-data` | `/root/.local/share/opencode` | Chats, sesiones y base de datos. |
| `vpscode-config` | `/root/.config/opencode` | Configuración, agentes y proveedores. |
| `vpscode-workspace` | `/workspace` | Proyectos del usuario. |

Recrear o actualizar el contenedor no elimina estos datos. Eliminar manualmente los volúmenes sí los elimina.

## Despliegue en EasyPanel

1. Crea un servicio con la opción **Compose/Composer**.
2. Conecta el repositorio `https://github.com/KalciferTolueno/vpscode`.
3. Selecciona la rama `v1.4`.
4. Usa el archivo `docker-compose.yml` de la raíz.
5. Define `OPENCODE_SERVER_PASSWORD` en las variables del servicio.
6. Inicia el build y espera a que el contenedor quede en ejecución.
7. Crea el dominio apuntando al servicio `vpscode`.
8. Configura el protocolo interno como `HTTP` y el puerto interno como `4096`.
9. Usa `/` como ruta y deja que EasyPanel termine TLS/HTTPS en el proxy.

El puerto `4096` es interno. No se debe apuntar el dominio a `80`, `443` ni a un puerto de un servidor de desarrollo abierto dentro del workspace.

## Verificación

El log de un arranque correcto incluye:

```text
opencode server listening on http://0.0.0.0:4096
```

Desde una consola dentro del contenedor se puede comprobar el servidor con:

```bash
bun -e "fetch('http://127.0.0.1:4096').then(r => console.log(r.status)).catch(console.error)"
```

Una respuesta `401` confirma que el servidor está accesible y que la autenticación está activa. Una respuesta `200` confirma que el servidor está accesible sin un desafío de autenticación.

## Error 502 en EasyPanel

Un `502 Bad Gateway` significa que el proxy de EasyPanel no puede conectarse al proceso del contenedor. No es un error del JavaScript de la interfaz.

Comprueba, en este orden:

1. El contenedor está en estado `Running` y no se reinicia continuamente.
2. El log contiene `http://0.0.0.0:4096`.
3. El dominio apunta al servicio Compose `vpscode`.
4. El puerto de destino es el interno `4096`.
5. El protocolo entre EasyPanel y el contenedor es `HTTP`, no `HTTPS`.
6. `OPENCODE_SERVER_PASSWORD` existe y no está vacío.
7. El build utiliza la rama `v1.4` y el `docker-compose.yml` de la raíz.

Si no aparece la línea de escucha, revisa el log desde el primer error. Si aparece y la prueba local responde, el problema está en la configuración del dominio o la red de EasyPanel.

## Navegador integrado

El navegador de la pestaña Browser es un iframe del proxy `/preview/<puerto>/`. No hace falta Chrome ni Chromium en el servidor. Los servidores de desarrollo deben escuchar en `0.0.0.0`, no solo en `127.0.0.1`.

Ejemplo con Vite en el puerto `5173`:

```bash
bun run dev -- --host 0.0.0.0 --port 5173
```

El proxy reescribe las rutas absolutas (`/src/main.tsx`, `/@vite/client`) para que el iframe las cargue como `/preview/5173/...`. No hace falta `--base`. Después, el navegador integrado accede mediante `/preview/5173/`. La aplicación principal continúa usando el puerto `4096`.

## Actualización

Para actualizar sin perder datos:

1. Conserva los tres volúmenes nombrados.
2. Actualiza el repositorio o la referencia de rama en EasyPanel.
3. Ejecuta un nuevo build del servicio Compose.
4. Verifica el log de escucha y el dominio.

Para volver a v1.3, selecciona la rama `v1.3` y vuelve a desplegar. Los volúmenes pueden reutilizarse.

## Copia de seguridad

Antes de cambios importantes, crea una copia de los tres volúmenes. Como mínimo, conserva `/root/.local/share/opencode` y `/workspace`; contienen las sesiones y los proyectos respectivamente.
