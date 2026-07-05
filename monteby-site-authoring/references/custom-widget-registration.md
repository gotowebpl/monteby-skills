# Custom Widget Registration

Monteby child-theme widgets are declared in PHP and rendered by WordPress. The MVP model is `schema + defaults + aiProps + PHP render_callback`; it does not require React editor components.

## Registration Hook

Register custom widgets from a child theme or site plugin:

```php
<?php

declare(strict_types=1);

add_action('monteby/widgets/register', function (): void {
    monteby_register_widget([
        'name' => 'ThemeClientHero',
        'label' => 'Client Hero',
        'category' => 'custom',
        'allowedParents' => ['Section', 'Container'],
        'defaults' => [
            'title' => 'Client Hero',
            'subtitle' => 'A concise client-specific hero.',
            'image' => '',
            'ctaLabel' => 'Read more',
            'ctaUrl' => '#',
        ],
        'schema' => [
            'sections' => [
                [
                    'title' => 'Content',
                    'fields' => [
                        ['type' => 'text', 'label' => 'Title', 'prop' => 'title'],
                        ['type' => 'textarea', 'label' => 'Subtitle', 'prop' => 'subtitle'],
                        ['type' => 'media', 'label' => 'Image', 'prop' => 'image'],
                        ['type' => 'text', 'label' => 'CTA label', 'prop' => 'ctaLabel'],
                        ['type' => 'text', 'label' => 'CTA URL', 'prop' => 'ctaUrl'],
                    ],
                ],
            ],
        ],
        'aiProps' => ['title', 'subtitle', 'image', 'ctaLabel', 'ctaUrl'],
        'render_callback' => 'theme_render_client_hero',
        'assets' => [
            'styles' => [],
            'scripts' => [],
        ],
    ]);
});

function theme_render_client_hero(array $props): string {
    $title = isset($props['title']) && is_scalar($props['title']) ? (string) $props['title'] : '';
    $subtitle = isset($props['subtitle']) && is_scalar($props['subtitle']) ? (string) $props['subtitle'] : '';
    $ctaLabel = isset($props['ctaLabel']) && is_scalar($props['ctaLabel']) ? (string) $props['ctaLabel'] : '';
    $ctaUrl = isset($props['ctaUrl']) && is_scalar($props['ctaUrl']) ? (string) $props['ctaUrl'] : '#';

    return sprintf(
        '<section class="theme-client-hero"><h1>%s</h1><p>%s</p><a href="%s">%s</a></section>',
        esc_html($title),
        esc_html($subtitle),
        esc_url($ctaUrl),
        esc_html($ctaLabel)
    );
}
```

## Rules

- `name` must be a unique PascalCase resolver name and cannot collide with core widgets.
- Custom widgets are leaf widgets in MVP. They must not be containers/canvases and must not have children.
- Use existing `Section` and `Container` widgets for layout.
- Every editable prop must be represented in `schema` and listed in `aiProps` if AI may author it.
- Do not expose `className`, `cssId`, raw HTML, raw CSS, JavaScript event handler props, or advanced/runtime props.
- The render callback must escape every value with WordPress escaping helpers such as `esc_html`, `esc_attr`, and `esc_url`.
- Callback output is sanitized by the Monteby runtime before rendering.

## Schema Field Types

Supported MVP control types:

- `text`
- `textarea`
- `number`
- `toggle`
- `select`
- `segment`
- `color`
- `css-value`
- `font-picker`
- `media`
- `spacing`
- `tag-list`
- `repeater`

For icons, expose a normal `text` prop containing a Material Symbols icon name and render it safely in PHP. For `select` and `segment`, include `options` as objects with `value` and `label`. For `spacing`, use `spacingProps` with `top`, `right`, `bottom`, and `left` prop names.

## AI Authoring Behavior

After registration, the widget appears in `GET /wp-json/monteby/v1/contract`. AI may use it only if it appears there. AI must still validate through `POST /wp-json/monteby/v1/validate` before saving with `PUT /wp-json/monteby/v1/pages/{id}/layout`.
