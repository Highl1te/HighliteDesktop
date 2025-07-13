import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';

export class AutoSprint extends Plugin {
	pluginName = 'AutoSprint';
  	pluginDescription = 'Automatically turns on Run/Sprint mode on login';
  	author = 'DarkIdol';

  	start(): void {
    	this.log('AutoSprint started');
  	}
  
	SocketManager_loggedIn(): void {
		if (!this.settings.enable.value) return;

		// Emit the packet to toggle on sprint
		this.gameHooks.SocketManager.Instance.emitPacket({ Name: 59, StrName: 59, Data: [1] });
	}
}
