// Efectos de luz del PopStatus. Cada estado tiene: efecto, color, brillo y velocidad.
#pragma once
#include "esphome.h"
#include <cmath>

namespace popstatus {
using namespace esphome;

struct Ajuste {
  select::Select *efecto;
  text::Text *color;
  number::Number *brillo;
  number::Number *vel;
};

enum Efecto { APAGADO = 0, FIJO, RESPIRAR, PARPADEO, ONDA, MARQUESINA, CICLO, ARCOIRIS, BARRA, COMETA };

inline Color hex_color(const std::string &s) {
  std::string h = s;
  if (!h.empty() && h[0] == '#') h = h.substr(1);
  if (h.size() != 6) return Color(255, 255, 255);
  char *fin = nullptr;
  unsigned long v = strtoul(h.c_str(), &fin, 16);
  if (fin == nullptr || *fin != '\0') return Color(255, 255, 255);
  return Color((v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF);
}

inline Color escala(const Color &c, float k) {
  if (k < 0) k = 0;
  if (k > 1) k = 1;
  return Color((uint8_t) (c.r * k), (uint8_t) (c.g * k), (uint8_t) (c.b * k));
}

// Arcoiris: tono 0..1 -> color
inline Color tono(float h) {
  h = h - floorf(h);
  float r = fabsf(h * 6 - 3) - 1, g = 2 - fabsf(h * 6 - 2), b = 2 - fabsf(h * 6 - 4);
  auto c = [](float x) { return (uint8_t) (255 * (x < 0 ? 0 : (x > 1 ? 1 : x))); };
  return Color(c(r), c(g), c(b));
}

// Pinta la barra. prog = 0..1 (para la barra de progreso), inv = invertir direccion, k = brillo final 0..1
// Para que sea fluido: se calcula todo en decimales, se aplica la curva de brillo (gamma 2.2) aqui
// y se reparte el resto con tramado temporal, asi los brillos bajos no van "a saltos".
inline void pintar(light::AddressableLight &it, const Ajuste &a, float prog, bool inv, float k, const Color *forzar = nullptr) {
  const int n = it.size();
  const float t = millis() / 1000.0f;
  const float v = (a.vel->state > 0 ? a.vel->state : 50) / 50.0f;  // 1.0 = normal
  const int ef = a.efecto->active_index().value_or(FIJO);
  const Color base = forzar ? *forzar : hex_color(a.color->state);
  k *= a.brillo->state / 100.0f;
  // Curva de brillo (gamma 2.2) y redondeo normal, sin tramado (el tramado se notaba).
  auto canal = [&](float x) -> uint8_t {
    float lin = powf(x < 0 ? 0 : (x > 1 ? 1 : x), 2.2f) * 255.0f;
    int r = (int) (lin + 0.5f);
    return (uint8_t) (r > 255 ? 255 : r);
  };
  auto pon = [&](int i, Color c, float f = 1.0f) {
    float m = f * k / 255.0f;
    it[inv ? n - 1 - i : i] = Color(canal(c.r * m), canal(c.g * m), canal(c.b * m));
  };
  auto suave = [](float x) { return x * x * (3 - 2 * x); };  // curva suave 0..1

  switch (ef) {
    case APAGADO:
      it.all() = Color::BLACK;
      return;
    case FIJO:
      for (int i = 0; i < n; i++) pon(i, base);
      return;
    case RESPIRAR: {
      float b = 0.30f + 0.70f * suave(0.5f + 0.5f * sinf(t * 3.0f * v));
      for (int i = 0; i < n; i++) pon(i, base, b);
      return;
    }
    case PARPADEO: {
      float x = 0.5f + 0.5f * sinf(t * 2 * M_PI * 2.0f * v);
      float b = 0.06f + 0.94f * suave(std::min(1.0f, std::max(0.0f, (x - 0.25f) * 2.0f)));  // parpadeo con bordes suaves
      for (int i = 0; i < n; i++) pon(i, base, b);
      return;
    }
    case ONDA:
      for (int i = 0; i < n; i++) pon(i, base, 0.1f + 0.9f * suave(0.5f + 0.5f * sinf(i * 0.45f - t * 4.0f * v)));
      return;
    case MARQUESINA: {
      float pos = t * 8.0f * v;
      for (int i = 0; i < n; i++) {
        float d = fmodf(i + pos, 4.0f);                     // punto que se desliza suavemente
        float f = std::max(0.0f, 1.0f - std::min(d, 4.0f - d));
        pon(i, base, 0.06f + 0.94f * suave(f));
      }
      return;
    }
    case CICLO: {
      Color c = tono(t * 0.08f * v);
      for (int i = 0; i < n; i++) pon(i, c);
      return;
    }
    case ARCOIRIS:
      for (int i = 0; i < n; i++) pon(i, tono((float) i / n + t * 0.15f * v));
      return;
    case BARRA: {
      float p = prog * n;
      int llenos = (int) p;
      float resto = p - llenos;
      float latido = 0.55f + 0.45f * suave(0.5f + 0.5f * sinf(t * 4.0f * v));
      for (int i = 0; i < n; i++) {
        if (i < llenos) pon(i, base);
        else if (i == llenos) pon(i, base, std::max(resto, 0.2f) * latido);
        else pon(i, base, 0.05f);
      }
      return;
    }
    case COMETA: {
      float cab = fmodf(t * 12.0f * v, (float) (n + 8));
      for (int i = 0; i < n; i++) {
        float d = cab - i;
        pon(i, base, (d >= 0 && d < 8) ? suave(1.0f - d / 8.0f) : 0.0f);
      }
      return;
    }
    default:
      for (int i = 0; i < n; i++) pon(i, base);
  }
}

}  // namespace popstatus
