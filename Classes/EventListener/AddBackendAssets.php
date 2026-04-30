<?php

declare(strict_types=1);

namespace WapplerSystems\SiteSetsExtras\EventListener;

use TYPO3\CMS\Backend\Controller\Event\AfterBackendPageRenderEvent;
use TYPO3\CMS\Core\Attribute\AsEventListener;
use TYPO3\CMS\Core\Page\JavaScriptModuleInstruction;
use TYPO3\CMS\Core\Page\PageRenderer;

final readonly class AddBackendAssets
{
    public function __construct(private PageRenderer $pageRenderer) {}

    #[AsEventListener(event: AfterBackendPageRenderEvent::class)]
    public function __invoke(): void
    {
        $this->pageRenderer->getJavaScriptRenderer()->addJavaScriptModuleInstruction(
            JavaScriptModuleInstruction::create(
                '@wapplersystems/site-sets-extras/Backend/SettingsNavigationCollapse.js'
            )
        );
    }
}