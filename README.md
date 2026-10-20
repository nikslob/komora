# Комора

Домашний склад продуктов — PWA для iPhone/Android. Без сервера, данные хранятся на устройстве.

- Сканер штрихкодов EAN-13/EAN-8/UPC: встроенный BarcodeDetector, а где его нет (Safari на iPhone) — [barcode-detector](https://github.com/Sec-ant/barcode-detector) 3.2.2 на zxing-wasm 3.1.3, лежат в `vendor/`, работают офлайн.
- Названия товаров по штрихкоду — [Open Food Facts](https://world.openfoodfacts.org) (уходит только номер штрихкода). Вручную введённые названия запоминаются локально.
- Остатки, списание, сроки годности, список покупок, экспорт/импорт JSON.

Запуск локально: `python3 -m http.server 8080`, затем http://localhost:8080.
На iPhone: открыть адрес в Safari → «Поделиться» → «На экран Домой».

При выпуске новой версии поменять `VERSION` в `app.js` и `CACHE` в `sw.js`.
