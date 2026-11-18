package com.livingthedream.travel;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* the app's own plugin (FileViewerPlugin: a PDF opens in a viewer,
           not the share sheet) — registered before the bridge starts */
        registerPlugin(FileViewerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
