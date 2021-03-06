/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UriComponents } from 'vs/base/common/uri';
import { ProcessItem } from 'vs/base/common/processes';

export interface IMachineInfo {
	os: string;
	cpus?: string;
	memory: string;
	vmHint: string;
}

export interface IDiagnosticInfo {
	machineInfo: IMachineInfo;
	workspaceMetadata?: { [key: string]: WorkspaceStats };
	processes?: ProcessItem;
}
export interface SystemInfo extends IMachineInfo {
	processArgs: string;
	gpuStatus: any;
	screenReader: string;
	load?: string;
}

export interface IDiagnosticInfoOptions {
	includeProcesses?: boolean;
	folders?: UriComponents[];
	includeExtensions?: boolean;
}

export interface WorkspaceStatItem {
	name: string;
	count: number;
}

export interface WorkspaceStats {
	fileTypes: WorkspaceStatItem[];
	configFiles: WorkspaceStatItem[];
	fileCount: number;
	maxFilesReached: boolean;
}