import os
import io
import os.path
import atexit

from flask import Flask, request, send_file
from flask_restful import Resource, Api, reqparse

from blinkpy.blinkpy import Blink
from blinkpy.auth import Auth
from blinkpy.helpers.util import json_load

version='0.1.4'
blink=Blink()
blinkStatus = 0
statusMessage = ''

blinkCredentials = os.environ.get("BLINK_CREDENTIAL_FILE")
blinkDownloadDir=os.environ.get("BLINK_DOWNLOAD_DIR")

if not blinkCredentials:
    blinkCredentials = "dwmdahoam.blink.credentials"
if not blinkDownloadDir:
    blinkDownloadDir = "."

def create_app():
    """ This function creates our flask app """
    flask_app = Flask(__name__)
    flask_app.logger.disabled = True

    flask_app.app_context().push()

    return flask_app

def InitBlink():
    global blinkStatus, statusMessage
    if not os.path.exists(blinkCredentials):
        blinkStatus = -1
        statusMessage ='Blink credential file '+blinkCredentials+' does not exist.'
    else:
        auth = Auth(json_load(blinkCredentials))
        blink.auth = auth
        blink.start()
        blinkStatus = 1
        statusMessage = 'Blink started ok'
    print ('Initblink finished: '+statusMessage)

class status(Resource):
    def get (self):
        return { 'message' : 'Ok', 'version' : version, 'status': blinkStatus, 'statusMessage' : statusMessage }

class blinksystem(Resource):
    def get (self):
        return { 'message': "Ok", 'version': version }, 200

class cameras (Resource):
    def get (self):
        result = {}
        for name, camera in blink.cameras.items():
            result[name]=camera.attributes
        return result, 200

class camera(Resource):
    def get (self, camid):
        print (camid)
        if camid in blink.cameras:
            camera=blink.cameras[camid]
            return { 'attributes': camera.attributes },200
        else:
            return { 'message':'Camera Id '+camid+' not found.'},400

class SyncModules(Resource):
    def get (self):
        blink.refresh()
        result = {}
        for name, module in blink.sync.items():
            result[name]=module.attributes
            result[name]['arm'] = blink.sync[name].arm
            result[name]['cameras'] = {}
            for camname,camera in blink.sync[name].cameras.items():
                result[name]['cameras'][camname] = blink.sync[name].cameras[camname].attributes
                    
        return result, 200

class SyncModuleArmed(Resource):
    def get (self,syncmodid):
        if syncmodid in blink.sync:
            blink.refresh()
            sync=blink.sync[syncmodid]
            return { 'message': 'Ok', 'status': sync.arm },200
        else:
            return {'message': 'SyncMod Id '+syncmodid+' not found.'}, 400

    def post (self,syncmodid):
        parser = reqparse.RequestParser(bundle_errors=True)
        parser.add_argument('armed', required=True,
                                   help='{error_msg}')
        request.get_json(force=True)
        json_data = parser.parse_args()

        print (json_data)

        if syncmodid in blink.sync:
            blink.refresh()
            if json_data.armed == '1':
                print ('Arming '+syncmodid)
                blink.sync[syncmodid].arm = True
            else:
                print ('Disarming '+syncmodid)
                blink.sync[syncmodid].arm = False
            
            return {'message': 'Ok', 'status': blink.sync[syncmodid].arm}, 200
        else:
            return {'message': 'SyncMod Id '+syncmodid+' not found.'}, 400

class CamImage(Resource):
    def get(self,camid):
        print(camid + "... retrieving image")
        if camid in blink.cameras:
            camera = blink.cameras[camid]
            blink.refresh()
            # camera.update_images()
            # return camera.image_to_file('/tmp/'+camid+'.jpg')
            # bytes-like image object (jpg)
            image_binary = camera.image_from_cache.raw.data
            # image_binary = camera.get_media().raw.data

            return send_file(
                # '/tmp/'+camid+'.jpg',
                io.BytesIO(image_binary),
                mimetype='image/jpeg',
                as_attachment=False)
        else:
            return {'message': 'Camera Id '+camid+' not found.'}, 400


class CamVideo(Resource):
    def get(self, camid):
        print(camid + "... retrieving video")
        if camid in blink.cameras:
            camera = blink.cameras[camid]
            blink.refresh(force_cache = True)
            # camera.update_images()
            # return camera.image_to_file('/tmp/'+camid+'.jpg')
            # bytes-like image object (jpg)
            if camera.video_from_cache != None:
                video_binary = camera.video_from_cache.raw.data
            else:
                return { 'message': 'failed, no video available' }, 401
            # image_binary = camera.get_media().raw.data

            return send_file(
                # '/tmp/'+camid+'.jpg',
                io.BytesIO(video_binary),
                mimetype='video/mp4',
                as_attachment=False)
        else:
            return {'message': 'Camera Id '+camid+' not found.'}, 400

class LiveView(Resource):
    def get(self,camid):
        if camid in blink.cameras:
            camera = blink.cameras[camid]
            return {'message': 'ok', 'liveview': camera.get_liveview()}
        else:
            return {'message': 'Camera Id '+camid+' not found.'}, 400


class SnapImage(Resource):
    def post(self, camid):
        if camid in blink.cameras:
            camera = blink.cameras[camid]
            return {'message': 'ok', 'liveview': camera.snap_picture()}
        else:
            return {'message': 'Camera Id '+camid+' not found.'}, 400


class SnapVideo(Resource):
    def post(self, camid):
        if camid in blink.cameras:
            camera = blink.cameras[camid]
            camera.record()
            return {'message': 'ok'}
        else:
            return {'message': 'Camera Id '+camid+' not found.'}, 400

def shutdown_atexit_handler():
    """
    This function is used to intercept SIGTERM signal
    issued by OS and perform any required shutdown activities
    or resource release gracefully
    """
    print('-----------------------------------------------')
    print('initiating graceful shutdown for Blink service...')
    blink.save(blinkCredentials)
    '''blink.auth.logout(blink)'''
    print('Exited Blink service...')
    print('-----------------------------------------------')
    return

app = create_app()
api = Api(app)


@app.errorhandler(404)
def resource_not_found(error):
    '''Return a custom message and 404 status code'''
    return {'message': error.description}, 404
    # return make_response(jsonify(Error_Code=e.code,Description=e.description), 404)


InitBlink()
atexit.register(shutdown_atexit_handler)

api.add_resource(blinksystem,'/')
api.add_resource(SyncModules,'/syncmodules')
api.add_resource(cameras, '/cameras')
api.add_resource(status, '/status')
api.add_resource(camera, '/camera/<camid>')
api.add_resource(CamImage,'/camera/<camid>/image')
api.add_resource(CamVideo, '/camera/<camid>/video')
api.add_resource(LiveView, '/camera/<camid>/liveview')
api.add_resource(SnapImage, '/camera/<camid>/snapimage')
api.add_resource(SnapVideo, '/camera/<camid>/record')
api.add_resource(SyncModuleArmed, '/syncmod/<syncmodid>/arm')

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug = True )  # important to mention debug=True
