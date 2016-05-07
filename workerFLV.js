importScripts('FLVInfo_min.js');


        function duree(s) {

            function onetotwo(Pint) {
                if (Pint < 10) {
                    return '0' + Pint.toString();
                } else {
                    return Pint.toString();
                }
            }

            function onetothree(Pint) {
                if (Pint < 10) {
                    return '00' + Pint.toString();
                } else {
                    if (Pint < 100) {
                        return '0' + Pint.toString();
                    } else {
                        return Pint.toString();
                    }
                }
            }

            var out = '';
            var lhh = '';
            var lmn = '';
            var lss = '';
            var lms = '';
            lhh = Math.floor(s / 3600);
            lmn = Math.floor((s - lhh * 3600) / 60);
            lss = Math.floor(s - lhh * 3600 - lmn * 60);
            lms = Math.ceil((s - lhh * 3600 - lmn * 60 - lss) * 1000);
            if (lhh > 0) {
                lhh = lhh.toString() + ":";
                out = lhh;
            }
            if (lmn > 0) {
                if (out.length == 0) {
                    out = lmn.toString() + ":";
                } else {
                    out = out + onetotwo(lmn) + ":";
                }
            } else {
                if (out.length > 0) {
                    out = out + "00:";
                }
            }
            if (lss > 0) {
                if (out.length == 0) {
                    out = lss.toString();
                } else {
                    out = out + onetotwo(lss);
                }
            } else {
                if (out.length == 0) {
                    out = "0";
                } else {
                    out = out + "00";
                }
            }
            if (lms != 0) {
                out = out + '.' + onetothree(lms);
            }
            return out;
        }

        function humanFileSize(size) {
            var i = Math.floor(Math.log(size) / Math.log(1024));
            return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['o', 'ko', 'Mo', 'Go', 'To'][i];
        };

        function humanBitrate(size) {
            var i = Math.floor(Math.log(size) / Math.log(1024));
            return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps'][i];
        };

        function human_reading(info) {
            info.text = "ArouG's FLV Infos :\n";
            info.text += "-------------------\n";
            if (info.parseMetaDataBREAK){
                info.text = "MetaDataParsing has been broken :\n";    
            }
            if (info.parseFlagsBREAK){
                info.text = "BEWARE : FLV parsing has been broken and factor 2 is supposed\n";    
            }
            info.text += "File : " + info.filename + "\n";

            var d= new Date(info.filedate);    
            info.text += "Date : " + (d.getFullYear()) + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes() + "\n";
            info.text += "Size : " + humanFileSize(info.filesize) + "\n";
            info.text += "Version FLV : "+info.FLVVers+"\n";
            info.dureeS = (info.lastStampTime - info.firstStampTime) / 1000;
            info.text += "Duration : " + duree(info.dureeS) + "\n";

            var Gbitrate = 0;
            Gbitrate = (info.AudionbB + info.VideonbB) * 8 / info.dureeS;     // kbps
            info.text += "Global bitrate : " + humanBitrate(Gbitrate) + "\n";
                
            if (info.onMetaData.metadatacreator){
                info.text += "Creator : " + info.onMetaData.metadatacreator + "\n";
            }    
            var tot = 0;
            if (info.AudionbB > 0) tot += 1;
            if (info.VideonbB > 0) tot += 1;
            info.text += "Count of streams : " + tot + "\n";
            info.text += "\n";

            if (info.VideonbB > 0){
                info.text += "Video Track Id : " + info.VideoCodecId + "\n";
                info.text += "Video Codec : " + info.VideoCodec;
                if (info.onMetaData.videocodecid){
                    if (isNaN(info.onMetaData.videocodecid)){
                        info.text += " (" + info.onMetaData.videocodecid + ")";    
                    }
                }
                info.text += "\n";
                info.text += "Size = " + humanFileSize(info.VideonbB) + "\n";
                info.text += "Bitrate : " + humanBitrate(info.VideonbB * 8 / info.dureeS) + "\n"; 
                if (info.onMetaData.framerate){
                    info.text += "Framerate : " + (info.onMetaData.framerate * info.factor) + " FPS\n"; 
                } else {
                    tot = Math.round(info.VideoTagsCount / (info.lastStampTime - info.firstStampTime)) / 1000;
                    info.text += "Framerate : " + tot + " FPS (*)\n"; 
                } 
                if (info.onMetaData.width){
                    info.text += "Width : " + (info.onMetaData.width * info.factor) + "\n";
                    info.text += "Heidth : " + (info.onMetaData.height * info.factor) + "\n";
                }
                info.text += "\n";
            }

            if (info.AudionbB > 0){
                info.text += "Audio Track Id : " + info.AudioCodecId + "\n";
                info.text += "Audio Codec : " + info.AudioFormat;
                if (info.onMetaData.audiocodecid){
                    if (isNaN(info.onMetaData.audiocodecid)){
                        info.text += " (" + info.onMetaData.audiocodecid + ")";    
                    }
                }    
                info.text += "\n";
                info.text += "Size = " + humanFileSize(info.AudionbB) + "\n";
                info.text += "Bitrate : " + humanBitrate(info.AudionbB * 8 / info.dureeS) + "\n"; 
                if (info.AudioFormat == 'AAC'){
                    info.text += "Profile : " + info.modeAAC + "\n";
                    info.text += "Count of channels : " + info.AACnbChannels + " (" + info.AACConfigChannels + ")\n";
                    if (info.onMetaData.audiosamplerate){
                        info.text += "Sampling : " + (info.factor * info.onMetaData.audiosamplerate / 1000) + " kHz\n";
                    } else {
                        info.text += "Sampling : " + (info.AudioSampling) + " kHz (*)\n";
                    }
                } else {
                    tot = 1;
                    if (info.AudioMode == "stereo"){
                        tot =2;
                    }
                    info.text += "Count of channels : " + tot + "\n";
                    info.text += "Mode : " + info.AudioMode + "\n";
                    info.text += "Sampling : " + (info.AudioSampling) + " kHz\n";
                }

            }
            return info.text;
        }


onmessage = function(event) {

  var file = event.data;
  var speedy = event.data.speedy;
    if (file.type == 'video/x-flv'){ 
        flv(file, function(err, info) {
          if (err) {
            console.log('error : ' + err);
            postMessage({
              'data' : 'error : ' + err
            });
          } else {
            sortie_texte = human_reading(info);
            postMessage({
              'data' : sortie_texte
            });
            //console.log(sortie_texte);
          }
        });
    } else {
        postMessage({'data' : 'nop'});
    }    
  }