# Hardware del BIQU PopStatus (versión Snapmaker U1)

Datos sacados de una unidad real, leyendo el chip y desmontando el firmware original para que funcione con otro software.

| Pieza | Detalle |
|---|---|
| Microcontrolador | **ESP32-C3** (QFN32, rev 1.1), 4 MB de flash integrada |
| USB-serie | **CH340K**. Lectura y escritura fiables solo a **230400 baudios** (a 460800 o 921600 se corrompe) |
| Seguridad | Secure Boot y Flash Encryption **desactivados** |
| LEDs | **27 × WS2812**, orden **GRB**, datos en **GPIO5** |
| Audio | Lleva un códec ES8311 (I2C/I2S). Sus pines no se han averiguado, así que este firmware no lo usa |

## Firmware original

- ESP-IDF v5.3.1 + ESP-ADF.
- Particiones:

| Partición | Dirección |
|---|---|
| nvs | `0x9000` |
| otadata | `0xc000` |
| app0 | `0x10000` |
| app1 | `0x200000` |
| coredump | `0x3f0000` |

- La web original usa un websocket en `ws://IP/ws` con mensajes como `{"rgb_switch":{"total_switch":0|1}}`.
- Sin impresora, el original ignora ese interruptor y deja una luz azul en movimiento.

## Cómo se encontró el pin de los LEDs

Se desensambló la app con capstone (RISC-V). El registro `gp` vale `0x3fc8fa00`. La tabla de canales RGB está en `gp-0x4c8` (`0x3fc8f538`), y su campo `+0x10` vale **5**, que es el **GPIO5**. Después se confirmó con un firmware de prueba que encendía la tira en verde.

## Notas del firmware alternativo

- `esp32_rmt_led_strip` con `rmt_symbols: 192`, que es toda la memoria RMT del C3. Con eso, más `power_save_mode: none` en el WiFi, desaparecen los destellos sueltos (verdes) que salían cuando había mucho tráfico WiFi.
- La curva de brillo (gamma 2.2) se aplica en `popstatus_fx.h`. Por eso la tira lleva `gamma_correct: 1.0`.
- Datos que se leen de Moonraker:
  - `print_stats` (estado, duración, capa actual y total)
  - `display_status.progress` y `virtual_sdcard.progress`
  - `heater_bed` y `extruder`…`extruder3`
  - `toolhead.extruder` (cabezal activo)
  - `print_task_config.filament_color_rgba`
- La U1 imprime con `current_layer = 0` mientras nivela o calibra. Este firmware lo enseña como el estado «Preparando».
