# PopStatus U1 · Custom Firmware

**🇪🇸 Español** · [🇬🇧 English](#-english)

Firmware **no oficial** para la barra LED **BIQU PopStatus** de la **Snapmaker U1**, hecho con [ESPHome](https://esphome.io).
Sustituye al software de fábrica y añade una página web propia para configurarlo todo.

> ⚠️ **No es oficial. No tiene relación con BIQU ni con Snapmaker.** Lo instalas bajo tu responsabilidad y puede afectar a la garantía.
> **Haz siempre una copia del firmware original antes** (explicado abajo). Con esa copia puedes volver atrás cuando quieras.

## ✨ Qué hace

- 💡 **11 estados**, cada uno con su **efecto, color, brillo y velocidad**:
  Sin impresora · Reposo · Preparando · Calentando · Imprimiendo · Pausa · Terminado · Error · Cama caliente · Enfriando · Listo para despegar
- 🔌 **Se apaga sola si la impresora está apagada**, en vez de quedarse con la luz azul.
- 🎨 **Color del filamento en uso** en la barra de progreso.
- 🛏️ **Detecta la placa por la temperatura de la cama**:
  - **PEI:** verde fijo al terminar.
  - **CryoGrip:** barra azul que se vacía mientras se enfría y verde cuando ya puedes despegar la pieza.
- ✨ **10 efectos:** Apagado, Fijo, Respirar, Parpadeo, Onda, Marquesina, Ciclo de color, Arcoíris, Barra de progreso y Cometa. Van a 30 fps, con curva de brillo y sin parpadeos.
- 📊 **Página web propia** en el navegador:
  - Vista de la barra en directo.
  - Capa, tiempo restante y temperaturas.
  - Botón para **probar cada estado en la barra real**.
- 🌙 **Modo noche** con horario y **apagado automático** en reposo.
- 📶 **WiFi configurable desde la web.** Si pierde la conexión, crea la red **«PopStatus rescate»** para configurarla otra vez.
- ⬆️ **Actualizaciones por WiFi (OTA):** no hace falta abrirlo.

Lee la impresora por **Moonraker** (puerto 7125), **solo lectura**. Nunca le manda órdenes.

## 🧰 Qué necesitas

- Un BIQU PopStatus para Snapmaker U1 (ESP32-C3).
- Un cable USB-C de datos y un PC.
- [Python 3](https://www.python.org/) con ESPHome y esptool: `pip install esphome esptool`

## 🚀 Instalación

### 1. Copia del firmware original (¡no te la saltes!)

Conecta el PopStatus por USB. Sale como un puerto COM (en Windows, por ejemplo `COM6`).

```bash
python -m esptool --port COM6 --baud 230400 read-flash 0 0x400000 copia_original.bin
```

> Usa **230400 baudios**: a más velocidad, el chip USB (CH340K) da errores de lectura.
> Hazla **dos veces** y comprueba que las dos copias son idénticas, por ejemplo comparando su SHA-256.
> ⚠️ Esa copia lleva dentro **tu contraseña del WiFi**: no la compartas.

### 2. Configura tus datos

```bash
cp secrets.example.yaml secrets.yaml      # y edita secrets.yaml con tu WiFi y contraseñas
```

En `popstatus.yaml`, cambia `ip_impresora` por la IP de tu Snapmaker U1. También puedes cambiarla después desde la web.

### 3. Instala

La primera vez, por cable:

```bash
python -m esphome run popstatus.yaml --device COM6
```

A partir de ahí, por WiFi:

```bash
python -m esphome run popstatus.yaml --device <ip-del-popstatus>
```

Abre `http://<ip-del-popstatus>` en el navegador y listo.

### ↩️ Volver al firmware de BIQU

```bash
python -m esptool --port COM6 --baud 230400 write-flash 0 copia_original.bin
```

## 🗂️ Archivos

| Archivo | Qué es |
|---|---|
| `popstatus.yaml` | Configuración principal: estados, lectura de la impresora y ajustes |
| `estado.yaml` | Plantilla con los ajustes de un estado (efecto, color, brillo y velocidad) |
| `popstatus_fx.h` | Los efectos de luz (C++) |
| `ui.js` | La página web propia |
| `secrets.example.yaml` | Ejemplo de contraseñas. Cópialo como `secrets.yaml` |
| `docs/hardware.md` | Notas del hardware (pines, chip, particiones) |

Si cambias un efecto en `popstatus_fx.h`, cámbialo también en `ui.js` para que la vista previa coincida.

## 📄 Licencia

[MIT](LICENSE). «BIQU», «PopStatus» y «Snapmaker» son marcas de sus dueños. Aquí solo se nombran para decir con qué aparato funciona.

---

## 🇬🇧 English

**Unofficial** firmware for the **BIQU PopStatus** LED bar for the **Snapmaker U1**, built with [ESPHome](https://esphome.io).
It replaces the stock firmware and adds its own web page to set everything up. The interface is in Spanish.

> ⚠️ **Not affiliated with BIQU or Snapmaker.** Use at your own risk; it may affect your warranty.
> **Always back up the original firmware first** (see below). You can restore it at any time.

**Features**
- 11 printer states, each with its own effect, colour, brightness and speed.
- Turns off when the printer is off.
- Active filament colour on the progress bar.
- PEI / CryoGrip plate detection by bed temperature:
  - PEI: solid green when the print finishes.
  - CryoGrip: blue "cooling" bar, then green when the part is ready to remove.
- 10 smooth effects at 30 fps.
- Live web UI with layers, time left and temperatures, plus "test this state on the bar".
- Night mode and auto-off when idle.
- Wi-Fi change from the web, plus a rescue hotspot.
- OTA updates.

It reads the printer through Moonraker (port 7125) and is **read-only**: it never sends commands.

**Install**
1. Back up the stock firmware:
   `python -m esptool --port COMx --baud 230400 read-flash 0 0x400000 original.bin`
   Use 230400 baud, because faster speeds corrupt reads on the CH340K.
2. `cp secrets.example.yaml secrets.yaml` and fill it in. Set `ip_impresora` to your printer's IP.
3. First flash over USB: `python -m esphome run popstatus.yaml --device COMx`. After that, use the device IP to update over Wi-Fi.
4. Restore stock: `python -m esptool --port COMx --baud 230400 write-flash 0 original.bin`

Hardware notes: [docs/hardware.md](docs/hardware.md). License: [MIT](LICENSE).
