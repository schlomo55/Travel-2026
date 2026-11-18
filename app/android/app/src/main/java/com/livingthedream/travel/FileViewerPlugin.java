package com.livingthedream.travel;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/* OPEN A FILE IN A VIEWER (18 Nov 2026, the offline phone test).

   A PDF tapped in Documents went to Android's SHARE sheet ("1 item",
   WhatsApp, Quick Share…) — the right gesture for a backup, the wrong one at
   an airline counter. This hands the same cached file to ACTION_VIEW instead,
   so the phone's own PDF reader opens it, with no network.

   The file is the one platform/files.ts has just written into the app's cache;
   it leaves the app through the FileProvider the manifest already declares
   (res/xml/file_paths.xml: cache-path "."), read-only, for that one intent. */
@CapacitorPlugin(name = "FileViewer")
public class FileViewerPlugin extends Plugin {

    @PluginMethod
    public void view(PluginCall call) {
        String path = call.getString("path");
        String mime = call.getString("mimeType", "application/pdf");
        if (path == null || path.isEmpty()) {
            call.reject("No file");
            return;
        }
        File file = new File(getContext().getCacheDir(), path);
        if (!file.exists()) {
            call.reject("File not found");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, mime);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(intent);
        } catch (ActivityNotFoundException ex) {
            /* no app on the phone can view it: the share sheet, as before */
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Open with");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(chooser);
        }
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }
}
