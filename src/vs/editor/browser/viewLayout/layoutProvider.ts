/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {IDisposable} from 'vs/base/common/lifecycle';
import * as editorCommon from 'vs/editor/common/editorCommon';
import {LinesLayout} from 'vs/editor/common/viewLayout/linesLayout';
import {ViewEventHandler} from 'vs/editor/common/viewModel/viewEventHandler';
import {ILayoutProvider} from 'vs/editor/browser/editorBrowser';
import {ScrollManager} from 'vs/editor/browser/viewLayout/scrollManager';

export class LayoutProvider extends ViewEventHandler implements IDisposable, ILayoutProvider, editorCommon.IWhitespaceManager {

	static LINES_HORIZONTAL_EXTRA_PX = 30;

	private configuration: editorCommon.IConfiguration;
	private privateViewEventBus:editorCommon.IViewEventBus;
	private model:editorCommon.IViewModel;
	private scrollManager:ScrollManager;
	private linesLayout: LinesLayout;

	constructor(configuration:editorCommon.IConfiguration, model:editorCommon.IViewModel, privateViewEventBus:editorCommon.IViewEventBus, linesContent:HTMLElement, viewDomNode:HTMLElement, overflowGuardDomNode:HTMLElement) {
		super();

		this.configuration = configuration;
		this.privateViewEventBus = privateViewEventBus;
		this.model = model;

		this.scrollManager = new ScrollManager(configuration, privateViewEventBus, linesContent, viewDomNode, overflowGuardDomNode);

		this.configuration.setLineCount(this.model.getLineCount());

		this.linesLayout = new LinesLayout(configuration, model);

		this._updateHeight();
	}

	public dispose(): void {
		this.scrollManager.dispose();
	}

	private updateLineCount(): void {
		this.configuration.setLineCount(this.model.getLineCount());
	}

	// ---- begin view event handlers

	public onZonesChanged(): boolean {
		this._updateHeight();
		return false;
	}

	public onModelFlushed(): boolean {
		this.linesLayout.onModelFlushed();
		this.updateLineCount();
		this._updateHeight();
		return false;
	}

	public onModelLinesDeleted(e:editorCommon.IViewLinesDeletedEvent): boolean {
		this.linesLayout.onModelLinesDeleted(e);
		this.updateLineCount();
		this._updateHeight();
		return false;
	}

	public onModelLinesInserted(e:editorCommon.IViewLinesInsertedEvent): boolean {
		this.linesLayout.onModelLinesInserted(e);
		this.updateLineCount();
		this._updateHeight();
		return false;
	}

	public onConfigurationChanged(e:editorCommon.IConfigurationChangedEvent): boolean {
		this.linesLayout.onConfigurationChanged(e);
		if (e.layoutInfo) {
			this.scrollManager.onLayoutInfoChanged();
			this._emitLayoutChangedEvent();
		}
		this._updateHeight();
		return false;
	}

	private _updateHeight(): void {
		this.scrollManager.setScrollHeight(this.getTotalHeight());
	}

	// ---- end view event handlers

	// ---- Layouting logic

	public getCurrentViewport(): editorCommon.Viewport {
		return new editorCommon.Viewport(
			this.scrollManager.getScrollTop(),
			this.scrollManager.getScrollLeft(),
			this.scrollManager.getWidth(),
			this.scrollManager.getHeight()
		);
	}

	public getCenteredViewLineNumberInViewport(): number {
		return this.linesLayout.getCenteredLineInViewport(this.getCurrentViewport());
	}

	private _emitLayoutChangedEvent(): void {
		this.privateViewEventBus.emit(editorCommon.EventType.ViewLayoutChanged, this.configuration.editor.layoutInfo);
	}

	public emitLayoutChangedEvent(): void {
		this._emitLayoutChangedEvent();
	}

	private _computeScrollWidth(maxLineWidth:number, viewportWidth:number): number {
		var isViewportWrapping = this.configuration.editor.wrappingInfo.isViewportWrapping;
		if (!isViewportWrapping) {
			return Math.max(maxLineWidth + LayoutProvider.LINES_HORIZONTAL_EXTRA_PX, viewportWidth);
		}
		return Math.max(maxLineWidth, viewportWidth);
	}

	public onMaxLineWidthChanged(maxLineWidth:number): void {
		var newScrollWidth = this._computeScrollWidth(maxLineWidth, this.getCurrentViewport().width);
		this.scrollManager.setScrollWidth(newScrollWidth);

		// The height might depend on the fact that there is a horizontal scrollbar or not
		this._updateHeight();
	}

	// ---- view state

	public saveState(): editorCommon.IViewState {
		var scrollTop = this.scrollManager.getScrollTop();
		var firstLineNumberInViewport = this.linesLayout.getLineNumberAtOrAfterVerticalOffset(scrollTop);
		var whitespaceAboveFirstLine = this.linesLayout.getWhitespaceAccumulatedHeightBeforeLineNumber(firstLineNumberInViewport);
		return {
			scrollTop: scrollTop,
			scrollTopWithoutViewZones: scrollTop - whitespaceAboveFirstLine,
			scrollLeft: this.scrollManager.getScrollLeft()
		};
	}

	public restoreState(state:editorCommon.IViewState): void {
		var restoreScrollTop = state.scrollTop;
		if (typeof state.scrollTopWithoutViewZones === 'number' && !this.linesLayout.hasWhitespace()) {
			restoreScrollTop = state.scrollTopWithoutViewZones;
		}
		this.scrollManager.setScrollPosition({
			scrollLeft: state.scrollLeft,
			scrollTop: restoreScrollTop
		});
	}

	// ---- IVerticalLayoutProvider

	public addWhitespace(afterLineNumber:number, ordinal:number, height:number): number {
		return this.linesLayout.insertWhitespace(afterLineNumber, ordinal, height);
	}
	public changeWhitespace(id:number, newAfterLineNumber:number, newHeight:number): boolean {
		return this.linesLayout.changeWhitespace(id, newAfterLineNumber, newHeight);
	}
	public removeWhitespace(id:number): boolean {
		return this.linesLayout.removeWhitespace(id);
	}
	public getVerticalOffsetForLineNumber(lineNumber:number): number {
		return this.linesLayout.getVerticalOffsetForLineNumber(lineNumber);
	}
	public heightInPxForLine(lineNumber:number): number {
		return this.linesLayout.getHeightForLineNumber(lineNumber);
	}
	public isAfterLines(verticalOffset:number): boolean {
		return this.linesLayout.isAfterLines(verticalOffset);
	}
	public getLineNumberAtVerticalOffset(verticalOffset:number): number {
		return this.linesLayout.getLineNumberAtOrAfterVerticalOffset(verticalOffset);
	}
	public getTotalHeight(): number {
		var reserveHorizontalScrollbarHeight = 0;
		if (this.scrollManager.getScrollWidth() > this.scrollManager.getWidth()) {
			reserveHorizontalScrollbarHeight = this.configuration.editor.scrollbar.horizontalScrollbarSize;
		}
		return this.linesLayout.getTotalHeight(this.getCurrentViewport(), reserveHorizontalScrollbarHeight);
	}
	public getWhitespaceAtVerticalOffset(verticalOffset:number): editorCommon.IViewWhitespaceViewportData {
		return this.linesLayout.getWhitespaceAtVerticalOffset(verticalOffset);
	}
	public getLinesViewportData(): editorCommon.ViewLinesViewportData {
		return this.linesLayout.getLinesViewportData(this.getCurrentViewport());
	}
	public getWhitespaceViewportData(): editorCommon.IViewWhitespaceViewportData[] {
		return this.linesLayout.getWhitespaceViewportData(this.getCurrentViewport());
	}
	public getWhitespaces(): editorCommon.IEditorWhitespace[] {
		return this.linesLayout.getWhitespaces();
	}

	// ---- IScrollingProvider

	public getOverviewRulerInsertData(): { parent: HTMLElement; insertBefore: HTMLElement; } {
		var layoutInfo = this.scrollManager.getOverviewRulerLayoutInfo();
		return {
			parent: layoutInfo.parent,
			insertBefore: layoutInfo.insertBefore
		};
	}
	public getScrollbarContainerDomNode(): HTMLElement {
		return this.scrollManager.getScrollbarContainerDomNode();
	}
	public delegateVerticalScrollbarMouseDown(browserEvent:MouseEvent): void {
		this.scrollManager.delegateVerticalScrollbarMouseDown(browserEvent);
	}
	public getScrollWidth(): number {
		return this.scrollManager.getScrollWidth();
	}
	public getScrollLeft(): number {
		return this.scrollManager.getScrollLeft();
	}
	public getScrollHeight(): number {
		return this.scrollManager.getScrollHeight();
	}
	public getScrollTop(): number {
		return this.scrollManager.getScrollTop();
	}

	public setScrollPosition(position:editorCommon.INewScrollPosition): void {
		this.scrollManager.setScrollPosition(position);
	}
	public getScrolledTopFromAbsoluteTop(top:number): number {
		return top - this.scrollManager.getScrollTop();
	}

	public renderScrollbar(): void {
		this.scrollManager.renderScrollbar();
	}
}