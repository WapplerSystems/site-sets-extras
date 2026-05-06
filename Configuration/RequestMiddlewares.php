<?php

declare(strict_types=1);

return [
    'backend' => [
        'wapplersystems/site-sets-extras/register-language-labels' => [
            'target' => \WapplerSystems\SiteSetsExtras\Middleware\RegisterLanguageLabels::class,
            'after' => [
                'typo3/cms-backend/authentication',
            ],
        ],
    ],
];
