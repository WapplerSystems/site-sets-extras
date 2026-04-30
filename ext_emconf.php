<?php

$EM_CONF[$_EXTKEY] = [
    'title' => 'Site Sets Extras',
    'description' => 'Quality-of-life UX improvements for the TYPO3 v13 backend Site Settings / Site Sets area.',
    'category' => 'be',
    'author' => 'WapplerSystems',
    'author_email' => 'info@wappler.systems',
    'state' => 'beta',
    'version' => '0.1.0',
    'constraints' => [
        'depends' => [
            'typo3' => '13.0.0-13.99.99',
            'backend' => '13.0.0-13.99.99',
        ],
        'conflicts' => [],
        'suggests' => [],
    ],
];