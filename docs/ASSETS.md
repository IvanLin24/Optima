# Предметная графика Оптимы

## optima-procurement-hero.png

- Файл: `dist/assets/optima-procurement-hero.png`.
- 1254 × 1254, PNG RGBA с прозрачностью, 1 155 706 байт.
- Создан встроенным инструментом `image_gen`, затем выполнена одна корректировка кадрирования тем же инструментом. Точные итоговые байты скопированы в проект без масштабирования.
- Назначение: графическая метафора объединённого спроса. Три отдельные белые посылки объединяет синяя лента. Это иллюстрация продукта, не схема физической консолидации доставки и не изображение реальных заказов.
- Используется на светлой сцене первого экрана и в пустом разделе закупок. Текст и финансовые значения находятся в HTML и рассчитываются из демонстрационных данных.
- Изображения и элементы Majestic в файл не переносились.

Финальный промпт корректировки:

> Use case: precise-object-edit  
> Edit the supplied transparent procurement still-life PNG. Preserve the exact sculptural composition, exactly three white corrugated parcels, single continuous cobalt blue satin ribbon loop, material quality, camera angle, proportions and lighting.  
> Change only framing and cutout edge quality: zoom the entire group out slightly and center it so every outer ribbon and parcel silhouette has at least 7% transparent canvas margin on every side, especially the right edge. The whole loop must be fully inside the canvas with no clipped pixels. Clean stray white and blue fringe flecks at the transparent edges. Preserve true transparency through all gaps and around the entire group; retain only subtle translucent contact shadow.  
> Square asset. No added objects or text. No background, no floor, no rectangle, no checkerboard texture. Keep exactly three parcels and the same single ribbon loop; all physical colors and styling unchanged.

## Остальные элементы

Товарные SVG-иллюстрации и иконки остаются локальными кодовыми ресурсами в `dist/js/icons.js`. Шрифты Golos Text и использованные открытые токены Admiral описаны в `THIRD-PARTY.md`.
