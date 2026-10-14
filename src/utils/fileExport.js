import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Alert, Platform, Linking } from 'react-native';
import { authService, resolveFileUrl } from '../services/api';

/**
 * Gets a clean mimeType and UTI for a given filename.
 */
export function getMimeAndUTI(filename) {
  const lower = (filename || '').toLowerCase().split('?')[0];
  if (lower.endsWith('.xlsx')) {
    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      uti: 'org.openxmlformats.spreadsheetml.sheet'
    };
  }
  if (lower.endsWith('.xls')) {
    return {
      mimeType: 'application/vnd.ms-excel',
      uti: 'com.microsoft.excel.xls'
    };
  }
  if (lower.endsWith('.pdf')) {
    return {
      mimeType: 'application/pdf',
      uti: 'com.adobe.pdf'
    };
  }
  if (lower.endsWith('.csv')) {
    return {
      mimeType: 'text/csv',
      uti: 'public.comma-separated-values-text'
    };
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return {
      mimeType: 'image/jpeg',
      uti: 'public.jpeg'
    };
  }
  if (lower.endsWith('.png')) {
    return {
      mimeType: 'image/png',
      uti: 'public.png'
    };
  }
  if (lower.endsWith('.webp')) {
    return {
      mimeType: 'image/webp',
      uti: 'org.webmproject.webp'
    };
  }
  if (lower.endsWith('.gif')) {
    return {
      mimeType: 'image/gif',
      uti: 'com.compuserve.gif'
    };
  }
  if (lower.endsWith('.doc')) {
    return {
      mimeType: 'application/msword',
      uti: 'com.microsoft.word.doc'
    };
  }
  if (lower.endsWith('.docx')) {
    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uti: 'org.openxmlformats.wordprocessingml.document'
    };
  }
  if (lower.endsWith('.txt')) {
    return {
      mimeType: 'text/plain',
      uti: 'public.plain-text'
    };
  }
  return {
    mimeType: 'application/octet-stream',
    uti: 'public.data'
  };
}

/**
 * Helper to save a file directly to Android storage via StorageAccessFramework (SAF).
 * If permission is denied or on iOS/Web, returns false so caller can gracefully fall back.
 */
export async function saveDirectToAndroidStorage(filename, mimeType, dataContent, isBase64 = false) {
  if (Platform.OS !== 'android') return false;
  const SAF = FileSystem.StorageAccessFramework;
  if (!SAF || typeof SAF.requestDirectoryPermissionsAsync !== 'function') return false;

  try {
    let initialUri = null;
    try {
      if (typeof SAF.getUriForDirectoryInRoot === 'function') {
        initialUri = SAF.getUriForDirectoryInRoot('Download');
      }
    } catch (_) {}

    const permissions = await SAF.requestDirectoryPermissionsAsync(initialUri);
    if (!permissions || !permissions.granted || !permissions.directoryUri) {
      return false; // User dismissed or cancelled directory picker, fall back to standard share sheet
    }

    // Strip extension from filename if present as createFileAsync handles it or appends it
    const extIndex = filename.lastIndexOf('.');
    const baseName = extIndex > 0 ? filename.substring(0, extIndex) : filename;

    const safFileUri = await SAF.createFileAsync(
      permissions.directoryUri,
      baseName,
      mimeType
    );

    await SAF.writeAsStringAsync(safFileUri, dataContent, {
      encoding: isBase64 ? 'base64' : 'utf8'
    });

    return { success: true, uri: safFileUri, method: 'direct_download' };
  } catch (err) {
    console.log('StorageAccessFramework save notice:', err.message);
    return false;
  }
}

/**
 * Exports a CSV string as a physical .csv file on the device.
 * - On Web: triggers immediate browser download to Downloads.
 * - On Android: saves directly to selected folder (e.g. Downloads) via SAF.
 * - On iOS or fallback: triggers native Save / Share sheet.
 */
export async function exportCSVFile(filename, csvContent) {
  try {
    const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    const bom = '\uFEFF';
    const fullContent = bom + csvContent;

    // 1. Web Platform direct download
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = cleanFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);
        return { success: true, method: 'web_direct_download' };
      }
    }

    // 2. Standard cache file writing first (guarantees local file exists for sharing/opening)
    const rawBaseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const baseDir = rawBaseDir.endsWith('/') ? rawBaseDir : `${rawBaseDir}/`;
    const fileUri = `${baseDir}${cleanFilename}`;

    await FileSystem.writeAsStringAsync(fileUri, fullContent, {
      encoding: 'utf8'
    });

    // 3. Android Direct Download via SAF
    if (Platform.OS === 'android') {
      const safResult = await saveDirectToAndroidStorage(cleanFilename, 'text/csv', fullContent, false);
      if (safResult && safResult.success) {
        Alert.alert(
          'Download Complete 📥',
          `Excel/CSV file "${cleanFilename}" downloaded directly to your selected folder.`,
          [
            {
              text: 'Open / Share',
              onPress: async () => {
                try {
                  const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
                  if (isSharingAvailable) {
                    await Sharing.shareAsync(fileUri, {
                      mimeType: 'text/csv',
                      dialogTitle: `Open ${cleanFilename}`,
                      UTI: 'public.comma-separated-values-text'
                    });
                  }
                } catch (_) {}
              }
            },
            { text: 'OK', style: 'default' }
          ]
        );
        return { success: true, uri: safResult.uri, localUri: fileUri };
      }
    }

    // 4. iOS / Fallback via Native Save to Files & Share Sheet
    const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
    if (isSharingAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${cleanFilename}`,
        UTI: 'public.comma-separated-values-text'
      });
      return { success: true, uri: fileUri };
    } else {
      Alert.alert('Download Complete 📥', `CSV file generated successfully at:\n${fileUri}`);
      return { success: true, uri: fileUri, fallback: true };
    }
  } catch (error) {
    console.error('Error exporting CSV file:', error);
    Alert.alert('Export Error', `Could not create CSV file: ${error.message || 'Unknown error'}`);
    return { success: false, error };
  }
}

/**
 * Generates an actual .pdf file from HTML content on the device.
 * - On Web: triggers browser print/save dialog.
 * - On Android: saves directly to selected folder (e.g. Downloads) via SAF.
 * - On iOS or fallback: triggers native Save / Share to Files dialog.
 */
export async function exportPDFFile(filename, htmlContent) {
  try {
    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    // 1. Web Platform handling
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 300);
          return { success: true, method: 'web_print' };
        }
      }
    }

    // 2. Generate physical PDF file on disk
    const printResult = await Print.printToFileAsync({
      html: htmlContent,
      base64: true
    });

    const tempPdfUri = printResult.uri;
    const base64Data = printResult.base64;

    const rawBaseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const baseDir = rawBaseDir.endsWith('/') ? rawBaseDir : `${rawBaseDir}/`;
    const targetUri = `${baseDir}${cleanFilename}`;

    try {
      await FileSystem.copyAsync({ from: tempPdfUri, to: targetUri });
    } catch (copyErr) {
      // If copy fails, continue with tempPdfUri
    }
    const finalUri = (await FileSystem.getInfoAsync(targetUri).catch(() => ({ exists: false }))).exists ? targetUri : tempPdfUri;

    // 3. Try direct Android SAF download
    if (Platform.OS === 'android') {
      try {
        let pdfBase64 = base64Data;
        if (!pdfBase64) {
          pdfBase64 = await FileSystem.readAsStringAsync(finalUri, {
            encoding: 'base64'
          });
        }
        const safResult = await saveDirectToAndroidStorage(cleanFilename, 'application/pdf', pdfBase64, true);
        if (safResult && safResult.success) {
          Alert.alert(
            'Download Complete 📥',
            `PDF Report "${cleanFilename}" downloaded directly to your selected folder.`,
            [
              {
                text: 'Open / Share',
                onPress: async () => {
                  try {
                    const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
                    if (isSharingAvailable) {
                      await Sharing.shareAsync(finalUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Open ${cleanFilename}`,
                        UTI: 'com.adobe.pdf'
                      });
                    }
                  } catch (_) {}
                }
              },
              { text: 'OK', style: 'default' }
            ]
          );
          return { success: true, uri: safResult.uri, localUri: finalUri };
        }
      } catch (safErr) {
        console.log('PDF direct save notice:', safErr.message);
      }
    }

    // 4. Fallback / iOS: Native Save to Files Sheet
    const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
    if (isSharingAvailable) {
      await Sharing.shareAsync(finalUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Export ${cleanFilename}`,
        UTI: 'com.adobe.pdf'
      });
      return { success: true, uri: finalUri };
    } else {
      Alert.alert('Download Complete 📥', `PDF document generated successfully at:\n${finalUri}`);
      return { success: true, uri: finalUri, fallback: true };
    }
  } catch (error) {
    console.error('Error generating PDF file:', error);
    Alert.alert('Export Error', `Could not generate PDF: ${error.message || 'Unknown error'}`);
    return { success: false, error };
  }
}

/**
 * Downloads a remote file (photo or document) directly to device storage.
 * - On Web: fetches as blob and triggers browser direct download to Downloads folder.
 * - On Android: downloads to local cache and writes directly into public folder (Downloads) using SAF.
 * - On iOS / Fallback: downloads to local sandbox and triggers native Save to Files / Share sheet.
 * 
 * @param {string} url - Remote file URL
 * @param {string} filename - Destination filename
 * @param {string} [customToken] - Optional JWT token override
 * @param {object} [options] - Configuration options
 */
export async function downloadFileDirectlyToDevice(url, filename, customToken, options = {}) {
  if (!url) {
    Alert.alert('File Unavailable', 'File URL is not specified.');
    return { success: false, error: new Error('Empty URL') };
  }

  const resolvedUrl = (typeof resolveFileUrl === 'function' ? resolveFileUrl(url) : url) || url;
  let cleanName = (filename || `attachment_${Date.now()}`).replace(/[/\\?%*:|"<>]/g, '_');

  // Ensure appropriate extension if missing
  if (!cleanName.includes('.')) {
    const { mimeType } = getMimeAndUTI(resolvedUrl);
    if (mimeType.includes('pdf')) cleanName += '.pdf';
    else if (mimeType.includes('png')) cleanName += '.png';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) cleanName += '.jpg';
    else if (mimeType.includes('sheet') || mimeType.includes('excel')) cleanName += '.xlsx';
    else if (mimeType.includes('word')) cleanName += '.docx';
    else cleanName += '.jpg';
  }

  // 1. Web Browser Execution: Blob-based Direct Download
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        let token = customToken;
        if (!token) {
          try { token = await authService.getToken(); } catch (_) {}
        }

        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(resolvedUrl, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = cleanName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
        return { success: true, method: 'web_direct_download' };
      }
    } catch (webErr) {
      console.warn('Web direct download notice:', webErr);
      try {
        if (typeof window !== 'undefined') {
          const link = document.createElement('a');
          link.href = resolvedUrl;
          link.download = cleanName;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return { success: true, method: 'web_anchor_download' };
        }
      } catch (_) {}
    }

    try {
      await Linking.openURL(resolvedUrl);
      return { success: true, method: 'web_link' };
    } catch (linkErr) {
      Alert.alert('Download Error', 'Could not initiate file download.');
      return { success: false, error: linkErr };
    }
  }

  // 2. Native Android / iOS Execution
  try {
    const rawBaseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const baseDir = rawBaseDir.endsWith('/') ? rawBaseDir : `${rawBaseDir}/`;
    const targetUri = `${baseDir}${cleanName}`;

    const headers = {};
    let token = customToken;
    if (!token) {
      try {
        token = await authService.getToken();
      } catch (_) {}
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let downloadResult = null;
    try {
      downloadResult = await FileSystem.downloadAsync(resolvedUrl, targetUri, { headers });
    } catch (downloadErr) {
      console.warn('FileSystem.downloadAsync notice:', downloadErr.message);
    }

    const { mimeType, uti } = getMimeAndUTI(cleanName);

    if (downloadResult && downloadResult.status === 200 && downloadResult.uri) {
      const localUri = downloadResult.uri;

      // Android: Save directly to selected directory (Downloads) via StorageAccessFramework
      if (Platform.OS === 'android') {
        try {
          const base64Data = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType ? FileSystem.EncodingType.Base64 : 'base64'
          });

          const safResult = await saveDirectToAndroidStorage(cleanName, mimeType, base64Data, true);
          if (safResult && safResult.success) {
            Alert.alert(
              'Download Complete 📥',
              `"${cleanName}" saved directly to your device.`,
              [
                {
                  text: 'Open / Share',
                  onPress: async () => {
                    try {
                      const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
                      if (isSharingAvailable) {
                        await Sharing.shareAsync(localUri, {
                          mimeType,
                          dialogTitle: `Open ${cleanName}`,
                          UTI: uti
                        });
                      }
                    } catch (_) {}
                  }
                },
                { text: 'OK', style: 'default' }
              ]
            );
            return { success: true, uri: safResult.uri, localUri };
          }
        } catch (safErr) {
          console.warn('Android SAF direct save fallback:', safErr.message);
        }
      }

      // iOS or fallback: System Share / Save to Files Sheet
      const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
      if (isSharingAvailable) {
        await Sharing.shareAsync(localUri, {
          mimeType,
          dialogTitle: `Save ${cleanName}`,
          UTI: uti
        });
        return { success: true, uri: localUri };
      } else {
        Alert.alert('Download Complete 📥', `File saved to:\n${localUri}`);
        return { success: true, uri: localUri, fallback: true };
      }
    }

    // Direct Browser / Link Fallback
    try {
      await Linking.openURL(resolvedUrl);
      return { success: true, method: 'browser_direct' };
    } catch (linkErr) {
      if (downloadResult && downloadResult.uri) {
        Alert.alert('Download Complete', `File saved to:\n${downloadResult.uri}`);
        return { success: true, uri: downloadResult.uri, fallback: true };
      }
      throw linkErr;
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    try {
      await Linking.openURL(resolvedUrl);
      return { success: true, method: 'browser_fallback' };
    } catch (finalErr) {
      Alert.alert('Download Failed', `Could not download "${cleanName}": ${error.message || 'Please check your connection.'}`);
      return { success: false, error };
    }
  }
}

export const downloadAndShareRemoteFile = downloadFileDirectlyToDevice;
export const openOrShareFile = downloadFileDirectlyToDevice;

