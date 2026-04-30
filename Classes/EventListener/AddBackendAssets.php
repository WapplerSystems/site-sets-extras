<?php

declare(strict_types=1);

namespace WapplerSystems\SiteSetsExtras\EventListener;

use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Attribute\AsEventListener;
use TYPO3\CMS\Core\Http\ApplicationType;
use TYPO3\CMS\Core\Page\Event\BeforeJavaScriptsRenderingEvent;

final class AddBackendAssets
{
    #[AsEventListener(event: BeforeJavaScriptsRenderingEvent::class)]
    public function __invoke(BeforeJavaScriptsRenderingEvent $event): void
    {
        if ($event->isInline()) {
            return;
        }
        $request = $GLOBALS['TYPO3_REQUEST'] ?? null;
        if (!$request instanceof ServerRequestInterface
            || !ApplicationType::fromRequest($request)->isBackend()
        ) {
            return;
        }
        $event->getAssetCollector()->addJavaScript(
            'site_sets_extras_collapse',
            'EXT:site_sets_extras/Resources/Public/JavaScript/Backend/SettingsNavigationCollapse.js',
            ['type' => 'module']
        );
    }
}