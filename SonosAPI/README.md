# SonosAPI - Anbindung an die Sonos REST API

## Voraussetzungen

Dieses Script ist für die Anbindung des ioBroker an einen SonosAPI Rest 
Server von https://github.com/jishi/node-sonos-http-api gedacht.
Entsprechend wird ein solcher, laufender Server unbedingt gebraucht.
Ebenfalls müssen auf diesem Server sog. "Webhooks" eingerichtet werden,
mit dem die SonosAPI diesem Script Rückmeldungen gibt.

Auf die Installation des SonosAPI Servers wird hier nicht genauer eingegangen,
dafür wird verwiesen auf:

- https://github.com/jishi/node-sonos-http-api
- https://github.com/chrisns/docker-node-sonos-http-api

und den die SonosAPI betreffenden Thread im ioBroker Forum:
- https://forum.iobroker.net/topic/22888/gel%C3%B6st-sonos-http-api-installation-f%C3%BCr-newbies-dummies-und-mich/

Soll für Text-To-Speach die [SSML Funktionalität von Amazon Polly](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html) verwendet werden, muss der SonosAPI Server mit einer Modifikation betrieben werden:
- https://github.com/jishi/node-sonos-http-api/pull/737

Eine weitere Voraussetzung ist das Vorhandensein der ebenfalls in diesem Repository zu findenden logging Funktion:
https://github.com/dwm66/iobroker-scripts/tree/master/debug-log

## Installation
Das Script benötigt die Javascript Module "http" und "url". Diese müssen im Javascript Adapter Konfiguration unter "zusätzliche Module" eingetragen werden.
Im Javascript Adapter muss ein neues Script angelegt werden. Dorthin kopiert man (Zwischenablage) den Inhalt der "sonosapi.js" Datei.
Im oberen Teil muss jetzt noch die Konfiguration angepasst werden.

```javascript

/**********************************************************************************************/
// Modify these settings
// BaseURL: the URL of the SonosAPI. Example: "http://10.22.1.40:5005"
var BaseURL = "http://10.22.1.40:5005";

// SonosAPIAuth: Authentication data for the Sonos API, if there a user and password is 
// declared.
// Example: 
// var SonosAPIAuth = "Basic " + new Buffer("username" + ":" + "Password123").toString("base64");
var SonosAPIAuth = "Basic " + new Buffer("admin" + ":" + "12345678").toString("base64");

// the port where this script should be reachable from the SonosAPI webhook mechanism.
// example: 
// var webHookPort = 1884;
// using this example, the settings.json on the Sonos API must contain:
// {
//   "webhook": "http://iobroker_uri:1884/"
// }
// replace "iobroker_uri" with the address of your iobroker machine.
var webHookPort = 1884;

// SSML Mode für sayEx. Unterstützt nur "Polly". Wenn auf "Polly gestellt ist, wird die Stimme auf"
// 90% Geschwindigkeit gesetzt. 
var SSMLMode = "Polly";

// datapoint where the sayEx function can get the current temperature 
var TempSensorId = "hm-rpc.0.ZEQ1234567.1.TEMPERATURE"/*Aussentemperatur Balkon:1.TEMPERATURE*/;

// URL of a fallback album art picture
var fallbackAlbumURL = 'https://10.22.1.40:8082/icons-mfd-svg/audio_volume_mid.svg';

/**********************************************************************************************/

```


Dann kann man das Script starten. Die Datenpunkte werden dann selbstständig vom Script angelegt.

## Benutzung
Die Datenpunkte geben grundsätzlich den von der SonosAPI gelieferten Zustand
wieder.
Manche Datenpunkte können auch benutzt werden, um Aktionen auszulösen, das sind

### Alles in .../Rooms/*Zimmer*/action

Die "Button"-Objekte werden einfach benutzt, indem in den state ein "true" 
geschrieben wird. 

Die States sind 
- play
- pause
- playpause (schaltet zwischen "Play" und "Pause" hin und her)
- next
- previous

Darüber hinaus gibt es
- clip: Spielt einen mp3 clip ab, dieser muss sich im "clip" Verzeichnis des SonosAPI Servers befinden.
- say:  Benutzt die Text-To-Speech Funktionalität des SonosAPI Servers, die dafür natürlich korrekt konfiguriert sein muss.
- favorite: Spielt einen Sonos-Favoriten ab
- sayEx: Erweiterte Funktionalität für say

### Verschiedene States
Alle diese States dienen zur Anzeige des aktuellen Zustands, und bei Beschreiben
wird dieser Zustand neu gesetzt.

- volume: Zeigt die Lautstärke an, setzt bei Beschreiben die neue Lautstärke
- trackNo: Aktueller Track, bei Beschreiben wird ein trackseek ausgeführt
- mute
- playMode/shuffle
- playMode/repeat: Gültige Werte sind "none", "one", "all"
- playMode/crossfade
- playbackStateSimple: Einfaches true/false, ist true, wenn abgespielt wird ("PLAYING"), sonst false. Setzen auf "true" sendet ein "PLAY" an die API,
  Setzen auf false sendet an die API ein "PAUSE"

Die Clip- und Say-Funktionen benutzen als Lautstärke den Wert, der bei dem entsprechenden Raum im Datenpunkt .../settings/clipVolume eingetragen ist.

### Globale Datenpunkte
Es gibt ein paar globale Datenpunkte, die für alle Zonen (Räume) gelten:
- FavList: Die Liste der Favoriten im System, durch einen ";" getrennt. Diese Favoritenliste kann in VIS in einem Dropdown Auswahl Element benutzt werden.
- RoomList: Liste der Räume/Zonen, durch ";" getrennt
- clipAll: Spielt auf allen Sonos einen Clip ab.
- sayAll: Ansagen mit dem TTS System auf allen Sonos
- pauseAll: Stoppt alle Sonos
- resumeAll: Spielt bei allen Sonos weiter. 
- sayAllEx: Erweiterte Ansage auf allen Sonos.


### sayEx Funktion

Diese Funktionalität (speziell das vorherige Abspielen des Clips) ist experimentell. 
An den Datenpunkt wird ein Objekt (als JSON-String!) gesendet:

```javascript
    setState(   "javascript.0.SonosAPI.Rooms."+targetZone+".action.sayEx",
                JSON.stringify({
                    messagebefore: messagebefore,
                    messagebehind: messagebehind,
                    sayTime: sayTime,
                    sayTemp: sayTemp,
                    sayDate: sayDate,
                    introClip: intro,
                    introClipLen: introlen
                })
```

Dabei bedeuten die Felder:
- messagebefore: Einleitung, was hier steht, wird als erstes gesagt.
- messagebehind: Was hier steht, wird zum Schluss angesagt
- sayTime: Schaltet eine Zeitansage ein
- sayTemp: Sagt die Aussentemperatur an
- sayDate: Sagt das aktuelle Datum an
- introClip: Clip, der ganz am Anfang abgespielt werden soll
- introClipLen: Länge des IntroClip in ms

Diese Teile werden kombiniert.
Das heisst, wird übergeben:

```
{
    messagebefore: "Servus!",
    messagebehind: "Das wird zum Ende zu angesagt",
    sayTime: true,
    sayTemp: true,
    sayDate: true,
    introClip: "gong.mp3",
    introClipLen: 2000
}
```

dann wird folgendes angesagt:

GONNNNGGGG
Servus!
Es ist 14:43 Uhr
Heute ist Dienstag, der 15. Januar
Die Außentemperatur betragt 5 Grad
Das wird zum Ende zu angesagt

### Erweiterte Funktionalität
Die allermeisten Funktionen des Scripts rufen direkt die SonosAPI auf und spiegeln das Verhalten des SonosAPI Servers wieder.
In einigen Punkten jedoch wurde ein erweitertes Verhalten eingebaut:
- Play: Manchmal ist das Sonos System in einem Zustand, in dem ein Drücken von "Play" einfach gar nichts bewirkt. Dies ist z.B. direkt nach dem Einschalten der Fall. Wird solch ein Zustand erkannt, wird beim Drücken von "Play" der DefaultFavorite gesetzt.
- AlbumURL: Manchmal wird von der SonosAPI keine AlbumURL gesendet. Das Script setzt in diesem Fall die entsprechenden Datenpunkte auf ein "Fallback" Icon.

# Beschränkungen

- Probleme bei An- und Abschalten von Sonos: Die SonosAPI reagiert nicht sehr 
  gut auf das Abschalten von Sonos-Geräten (also wirklich das Trennen vom Netz).
  Die Erkennung der Topologieänderung dauert sehr lange. Solange diese Änderung
  aber nicht erkannt ist, schlagen alle "all" Aufrufe wie "pauseall", "resumeall" etc. 
  mit einem Fehler 500 des Servers fehl.
- sayAllEx: Hier ist das vorherige Abspielen des Clips nicht möglich, durch
  die Gruppierungsfunktionen der API geht das einfach nur schief. 
- elapsedTime ... das funktioniert relativ schlecht, da die Zustandsänderungen
  meist nur beim Wechsel des Tracks gesendet werden. Dabei wird beim neuen
  Track die elapsedTime immer auf "0" gesetzt. 

- Die Funktionalität für Amazon Music, Spotify etc. ist (noch?) nicht implementiert.
  Ein Workaround zum Starten von Amazon Music etc. ist die Aufnahme der Playlists oder Alben
  in die Sonos Favorites.
- Gruppierungsfunktionen sind noch nicht implementiert.
- Gruppen-Volume Funktionen sind nohc nicht implementiert.
- keine Unterstützung von clipVolume bei clipAll/sayAll

# Todos
- Group Funktionalität: /join /leave, Coordinator List ...
- Group Volume show/set
- elapsedTime verbessern, das Script könnte hier selbst einen Zähler starten.
- Amazon Music, Spotify
