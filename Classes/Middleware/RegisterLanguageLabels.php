<?php

declare(strict_types=1);

namespace WapplerSystems\SiteSetsExtras\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use TYPO3\CMS\Core\Page\PageRenderer;

/**
 * Registers this extension's inline language labels early in the backend
 * request lifecycle. Doing it from BeforeJavaScriptsRenderingEvent is too
 * late: PageRenderer::renderMainJavaScriptLibraries() compiles
 * inlineLanguageLabelFiles into the TYPO3.lang global before that event
 * fires, so additions during the event are silently dropped. A PSR-15
 * middleware is the earliest reliable hook on backend requests.
 */
final class RegisterLanguageLabels implements MiddlewareInterface
{
    public function __construct(
        private readonly PageRenderer $pageRenderer,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $this->pageRenderer->addInlineLanguageLabelFile(
            'EXT:site_sets_extras/Resources/Private/Language/locallang.xlf'
        );
        return $handler->handle($request);
    }
}
