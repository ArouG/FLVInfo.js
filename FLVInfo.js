/**
 * FLVInfo 
 * v 1.0   2016/05/08 
 *
 *       Documentation :
 *             https://fossies.org/linux/MediaInfo_CLI/MediaInfoLib/Source/MediaInfo/Multiple/File_Flv.cpp
 *             http://atsc.org/wp-content/uploads/2015/03/A153-Part-8-2012.pdf
 *             http://www.iis.fraunhofer.de/content/dam/iis/de/doc/ame/wp/FraunhoferIIS_Application-Bulletin_AAC-Transport-Formats.pdf
 *             http://blog.csdn.net/jwybobo2007/article/details/9221657
 *             http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio
 *                  
 */
"use strict";

var flv = function(opts, flvcb) {
    var info = {};
    var atoms;
    var options = {
        type: 'uri',
    };
    if (typeof opts === 'string') {
        opts = {
            file: opts,
            type: 'uri'
        };
    } else 
    /******************************************************************************************************
               Can't be good for workers : they don't know anything about window !!
    if (typeof window !== 'undefined' && window.File && opts instanceof window.File)
    ********************************************************************************************************/
            {
        opts = {
            file: opts,
            type: 'file'
        };
        info.filesize = opts.file.size;
        info.filename = opts.file.name;
        info.filedate = opts.file.lastModifiedDate;
        info.FLVVers = 0;
        info.parseMetaDataBREAK = false;
        info.parseFlagsBREAK = false;

        info.hasVideo = false;
        info.hasAudio = false;
        info.hasEncrypted = false;
        info.hasScript = false;
        info.FileOffBuff = 0;
        info.BuffLength = 0;
        info.LastBuffPos = 0;

        info.AudioFormat = '';
        info.AudioSampling = 0;    // kHz
        info.AudioDeep = 0;
        info.AudioMode ='';
        info.AudioCodecId = '';
        // info specifics AAC
        info.modeAAC = '';
        info.AudioAACProfile = '';
        info.AACnbChannels = 0;
        info.AACConfigChannels = '';

        info.firstStampTime = '';
        info.lastStampTime = '';

        info.VideoCodec = '';
        info.VideoCodecId = '';
        info.TagsCount=0;
        info.tags=[];
        info.AudionbB = 0;
        info.VideonbB = 0;
        info.ScriptTagsCount = 0;
        info.AudioTagsCount = 0;
        info.VideoTagsCount = 0;
        info.tag = {};
        info.meta = {};
        info.onMetaData = {};
        info.meta.pairkey = '';
        info.factor = 0;
        info.factordefined = false;
        info.factorbug = false;
    }
    for (var k in opts) {
        options[k] = opts[k];
    }

    if (!options.file) {
        return cb('No file was set');
    }

    /******************************************************************************************************
               Can't be good for workers : they don't know anything about window !!
    if (options.type === 'file') {
        if (typeof window === 'undefined' || !window.File || !window.FileReader || typeof ArrayBuffer === 'undefined') {
            return cb('Browser does not have support for the File API and/or ArrayBuffers');
        }
    } else if (options.type === 'local') {
        if (typeof require !== 'function') {
            return cb('Local paths may not be read within a browser');
        }
        var fs = require('fs');
    } else {} /* Buffer Utitlities */
    /******************************************************************************************************/

    var FLVTree = {};
    FLVTree.parse = function(handle, callback) {
        var FLVEOFTag = 0; 
        var FLVAudioTag = 8;
        var FLVVideoTag = 9;
        var FLVScript = 18;
        var FLVRmTag = 0xFA;
        var FLVTags = [FLVEOFTag, FLVAudioTag, FLVVideoTag, FLVScript, FLVRmTag];

        var FLVEndOfFile = 0;
        var FLVRealMedia = 0xFA;                   // RM metadata 

        var SoundFormat = ['Linear PCM, platform endian', 'ADPCM', 'MP3', 'Linear PCM, little endian', 
                           'Nellymoser 16 kHz mono', 'Nellymoser 8 kHz mono', 'Nellymoser', 'G.711 A-law logarithmic PCM',
                           'G.711 mu-law logarithmic PCM', 'reserved', 'AAC', 'unknown', 
                           'unknown', 'Speex', 'MP3 8 kHz', 'Device-specific sound' ];
        var AudioSampling = [5.5, 11.025, 22.05, 44.1];
        var AudioDeep = [8, 16];
        var AudioMode = ['mono', 'stereo'];  

        var VideoCodec = ['unknown', 'unknown', 'Sorenson H.263', 'Screen video', 'On2 VP6', 'On2 VP6 with alpha channel', 'Screen video version 2', 'AVC', 'unknown', 'unknown', 'unknown', 'unknown', 'HEVC'];              

        var BuffSize=16*16*1024;                   // could be adapted : size of standard buffer used in this module : must be greater than 2 BuffSecure !
        var BuffLength;
        var buffpos;
        var Filepos = 0;
        var BuffSecure = 8192;                     // precaution : if too small we could cross the limit of the buffer !
        var TabScriptsValue = [0, 1, 2, 3, 7, 8, 10, 11, 12];
        var AACMode = ['Main Profile (MP)', 'Low Complexity (LC)', 'Scalable Sampling Rate profile (SSR)', 'Long Term Prediction (LPT)', 'Spectral Band Replication (SBR)', 'AAC Scalable'];
        var AACFrequencies = [96, 88.2, 64, 48, 44.1, 32, 24, 22.05, 16, 12, 11.025, 8, 7.35]                                        // in kHz ( ind< 13)
        var AACChannelsConfig = ['unknown', [1, 'FC'], [2, 'FL/FR'],[3, 'FC/FL/FR'],[4, 'FC/FL/FR/BC'], 
                                 [5, 'FR/FL/FR/BL/BR'], [6, 'FC/FL/FR/BL/BR/LFE-channel'], [8, 'FC/FL/FR/SL/SR/BL/BR/LFE-channel']]; // (ind < 8)

        function litHex(buffer, pos, nb){
            var id = [];
            for (var i = pos; i < pos+nb; i++) {
                var tmp=buffer.getUint8(i).toString(16);
                if (tmp.length == 1) tmp='0'+tmp;
                id.push(tmp);
            }
            return id.join("");
        }

        function litCar(buffer, pos, nb){
            var id = [];
            for (var i = pos; i < pos+nb; i++) {
                id.push(String.fromCharCode(buffer.getUint8(i)));
            }
            return id.join("");
        }


        function readBytes(nbB, offset, cb) {
            handle.read(nbB , offset , function retrB(err, buffer) {
                if (err){
                    cb(err);
                } else {
                    var dv = new DataView(buffer);
                    cb(null,dv);
                }
            });
        }

        function doubleprec(val){  // 1, 11, 52
            var sig, exp, mexp, mant, nmant, tmp;    
            sig = parseInt(val / Math.pow (2, 63));
            exp = parseInt(val / Math.pow (2, 52)) - (sig * Math.pow(2, 12));
            mant = val - (exp * Math.pow(2, 52)) - (sig * Math.pow(2, 63));
            nmant = mant.toString(2);
            tmp = 1;
            for (var k=0; k<nmant.length; k++){
                if (nmant[nmant.length-1-k] == '1'){
                    tmp += Math.pow(2, -52+k);
                }
            }
            nmant = tmp;
            mexp = exp.toString(2);
            tmp = 0;
            for (var k=0; k<mexp.length; k++){
                if (mexp[mexp.length-1-k] == '1'){
                    tmp += Math.pow(2, k);
                }
            }
            mexp = tmp;
            tmp = Math.pow (2, mexp-1024) * nmant;
            if (sig == 1) tmp = -tmp;
            return tmp;
        }

        function headerFile(buffer){
            var buffpos=0;
            if (litCar(buffer,buffpos,3) == 'FLV'){
                info.FLVVers = buffer.getUint8(buffpos+3);
                var flags = buffer.getUint8(buffpos+4);
                if (((flags & 0xF8) != 0) || ((flags & 0x2) != 0)){
                    return 0;    
                } else {
                    if ((flags & 0x04) == 0x04) info.hasAudio = true;
                    if ((flags & 0x01) == 0x01) info.hasVideo = true;
                    var HeaderLength = buffer.getUint32(buffpos+5,false);
                    buffpos = HeaderLength;
                    buffpos += 4;
                    var eqzero = buffer.getUint32(buffpos-4,false);
                    if (eqzero != 0){
                        return 0; 
                    } else {
                        return buffpos;
                    }
                }
            } else {
                return 0;
            }
        }

        function FLVReadTag(buffer,buffpos){
            info.TagsCount += 1;
            info.LastBuffPos = buffpos;
            info.tag.flags = buffer.getUint8(buffpos);
            info.tag.filter = (info.tag.flags & 0x20) >> 5;                              // if (filter == 1) pre-processing of the packet is required
            info.tag.tagtype = info.tag.flags & 0x1F;                                    // 8 audio, 9 video, 18 script
            info.tag.datasize = buffer.getUint32(buffpos, false) & 0xFFFFFF;
            info.tag.timestamp = buffer.getUint32(buffpos+3, false) & 0xFFFFFF;
            info.tag.timestamp += buffer.getUint8(buffpos+7) * 16777216;                 // (1 << 24)
            if (info.firstStampTime == '') info.firstStampTime = info.tag.timestamp;
            info.lastStampTime = info.tag.timestamp;
            info.tag.eqzero = buffer.getUint32(buffpos+7, false) & 0xFFFFFF;             // StreamID
            return info.tag.tagtype;          
        }

        function end_of_metatag(buffer){
            if (info.meta.LevelsEnd.length > 0){                                              // Is this value in an Object / StrictArray / ECMA_Array ?
                if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].typ == 'strictarray'){  // In a StrictArray ?
                    info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].count--;
                    if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].count == 0){        // Last index of the StrictArray ?
                        //info.meta.StringObject += '},';                                     // for debugging
                        info.meta.LevelsEnd.pop();                                            // close last LevelsEnd
                        while (litHex(buffer, info.meta.pos, 3) ==  '000009'){                // CAUTION : it would be TOO the end of Object or ECMA_Array
                            //info.meta.StringObject += '},';                                 // If so, close Object or ECMA_Array too !
                            info.meta.pos += 3;
                            info.meta.LevelsEnd.pop(); 
                        }
                        info.meta.nexttype = false;                                           // if last value for a structure, then next param is a STRING !
                        info.meta.scriptdatavalue = 2; 
                        info.meta.nexttag = false;                                            // skip 0 -> 2 or 1 -> 2 must go to the top of the loop : Verify length of metatags.
                    } else {
                        //info.meta.StringObject += ',';                                      // else next index of the StrictArray for debugging
                    }
                } else {                                                                      // Object or ECMA_Array
                    if (litHex(buffer, info.meta.pos, 3) != '000009'){                        
                        if (((info.meta.scriptdatavalue == 2) && info.meta.ispairvalue) || (info.meta.scriptdatavalue != 2)){
                            //info.meta.StringObject += ',';                                  // for debugging
                            info.meta.ispairvalue = false;                                    // next param will be an property / key : not a value !
                            info.meta.nexttype = false;
                            info.meta.scriptdatavalue = 2;                                    // so next param is a STRING ! 
                        } else {
                            info.meta.ispairvalue = true;                                     // it's a string type property so next value is a pair value
                            info.meta.nexttype = true;  
                        }
                    } else {    
                        while (litHex(buffer, info.meta.pos, 3) ==  '000009'){                // CAUTION : it would be TOO the end of another Object or ECMA_Array
                            //info.meta.StringObject += '},';                                 // If so, close Object or ECMA_Array too ! for debugging
                            info.meta.pos += 3;
                            info.meta.LevelsEnd.pop(); 
                            info.meta.nexttype = false;                                       // necessary last value for a structure, so next param is a STRING !
                            info.meta.scriptdatavalue = 2;  
                            info.meta.nexttag = false;                                        // skip 0 -> 2 or 1 -> 2 must go to the top of the loop : Verify length of metatags.
                        }
                    }
                }
            }
        }    

        function inArray(needle, haystack) {
            var length = haystack.length;
            for(var i = 0; i < length; i++) {
                if(haystack[i] == needle) return true;
            }
            return false;
        }

        function StrChf(){
            var StrCh = info;
            for (var i=0; i<info.meta.LevelsEnd.length; i++){
                StrCh = StrCh[info.meta.LevelsEnd[i]["chaine"]];
            }
            return StrCh;
        }

        function setFactor(){
            if (info.onMetaData.audiocodecid){
                if (!isNaN(info.onMetaData.audiocodecid)){
                    info.factor = info.AudioCodecId / info.onMetaData.audiocodecid;    
                }
            }
            if (info.factor == 0){
                if (info.onMetaData.videocodecid){
                    if (!isNaN(info.onMetaData.videocodecid)){
                        info.factor = info.VideoCodecId / info.onMetaData.videocodecid; 
                    }    
                }
            }
            if (info.factor == 0){
                if (info.onMetaData.duration){
                    info.factor = Math.round(Math.abs(((info.lastStampTime - info.firstStampTime) / 1000) / info.onMetaData.duration)); 
                }
            }
            if (info.factor == 0){
                if (info.onMetaData.videosize){
                    info.factor = Math.round(info.VideonbB / Math.round(info.onMetaData.videosize));       
                }
            }  
            if (info.factor == 0){                      // Assume that info.VideoTagsCount = nb frames ??
                if (info.onMetaData.framerate){
                    info.factor = Math.round((info.VideoTagsCount / (info.lastStampTime - info.firstStampTime)) * 1000 / info.onMetaData.framerate);
                }
            }    
            if (info.factor == 2){
                info.factordefined = true;
            } else {
                if (info.factor > 0){
                    info.factorbug = true;
                } else {
                    info.factor = 2;
                }

            }
        }


        function LoadBuffer(BuffOffset, suite){

            var offset = BuffOffset;
            var nbB = BuffSize;
            if (info.filesize - offset < BuffSize){
                nbB =info.filesize - offset;
            }
            readBytes(nbB, offset, function(err, buffer){
                if (err){
                    return suite(err);
                } else {
                    // traite Buffer
                    info.BuffLength = buffer.byteLength;
                    info.FileOffBuff = BuffOffset;
                    var buffpos = 0;
                    if (BuffOffset == 0){
                        buffpos = headerFile(buffer);
                        if (buffpos == 0){
                            return suite('This is not a FLV file');
                        }
                    }
                    while  (buffpos + 15 <= info.BuffLength){
                        // read FLVTag
                        var tagtype = FLVReadTag(buffer,buffpos);        

                        if (tagtype == FLVEOFTag){
                            buffpos = info.BuffLength;
                            info.FileOffBuff = info.filesize;
                        }

                        if (tagtype == FLVRmTag){    // skip !
                            // do nothing 
                        }

                        if (tagtype == FLVAudioTag){
                            //TypTag = 'Audio';
                            info.AudionbB += info.tag.datasize;
                            info.AudioTagsCount += 1;
                            if (info.AudioFormat == ''){
                                var tagHeader = buffer.getUint8(buffpos+11);
                                var Snd = (tagHeader & 0xF0) >> 4;
                                info.AudioCodecId = Snd;
                                info.AudioFormat = SoundFormat[Snd];
                                var Srate = (tagHeader & 0x0C) >> 2;
                                info.AudioSampling = AudioSampling[Srate];
                                var Ssize = (tagHeader & 0x02) >> 1;
                                info.AudioDeep = AudioDeep[Ssize];
                                info.AudioMode = AudioMode[tagHeader & 0x01];
                                // Special case :
                                if (Snd == 4) info.AudioSampling = 16;
                                if (Snd == 5) info.AudioSampling = 8;
                                if (Snd == 10) {
                                    // case of AAC
                                    if (buffer.getUint8(buffpos+12) == 0){                                            // AAC Sequence header : it will be the first audioTag I hope !!
                                        info.AudioAACProfile = buffer.getUint16(buffpos+13,false);
                                        // Not sure :
                                        var AOT = (info.AudioAACProfile & 0xF800) >> 11;
                                        if (AOT < 7){
                                            info.modeAAC = AACMode[AOT-1];
                                            var samplingFrequencyIndex = (info.AudioAACProfile & 0x0710) >> 7;
                                            if (samplingFrequencyIndex < 13){                                         // ignore else
                                                info.AudioSampling = AACFrequencies[samplingFrequencyIndex];
                                            }
                                            var channelConfiguration = (info.AudioAACProfile & 0x0078) >> 3;
                                            if ((channelConfiguration < 8) && (channelConfiguration >0 )) {
                                                info.AACnbChannels = AACChannelsConfig[channelConfiguration][0];
                                                info.AACConfigChannels = AACChannelsConfig[channelConfiguration][1];
                                            }
                                            var AACFrameLengthConf = (info.AudioAACProfile & 0x0040) >> 2;            // 0 : 1024 samples by packet / 1 : 960 !
                                        } else {
                                            info.modeAAC = 'unknown'; 
                                        }
                                    }
                                }
                            }
                        } 

                        if (tagtype == FLVVideoTag){
                            //TypTag = 'Video'; 
                            info.VideonbB += info.tag.datasize;   
                            info.VideoTagsCount += 1; 
                            if (info.VideoCodec == ''){
                                var tagHeader = buffer.getUint8(buffpos+11);
                                var codecId = (tagHeader & 0x0F); 
                                info.VideoCodecId = codecId;
                                var frameType = (tagHeader & 0xF0) >> 4; 
                                info.VideoCodec = VideoCodec[codecId];  
                                if ((codecId == 7) && (frameType == 1)){                                 // AVC sequence header
                                    var truc=5;
                                }    
                            }
                        }

                        if (tagtype == FLVScript){                                                       // Parsing FLVscript
                            info.ScriptTagsCount += 1;
                            info.meta.pos = buffpos+11;
                            info.meta.LevelsEnd=[];
                            info.meta.StringObject = "";                                                 // for Debugging
                            info.meta.nexttype = true;
                            info.meta.ispairvalue = false;
                            info.meta.nexttag = true;
                            info.meta.scriptdatavalue = '';
                                                                                                         //  Don't try to parse MetaData if the buffer is too small !
                            if (info.tag.datasize + buffpos + 11 <= info.BuffLength){
                                while (info.meta.pos < info.tag.datasize + buffpos + 11){
                                    info.meta.nexttag = true;
                                    if (info.meta.nexttype){                                             // Should we read a scriptdatavalue ?
                                        info.meta.scriptdatavalue = buffer.getUint8(info.meta.pos);
                                        info.meta.pos += 1;
                                    }                                

                                    if (info.meta.scriptdatavalue == 0){                                 // DOUBLE <=> Float64
                                        var val = buffer.getUint32(info.meta.pos, false) * 4294967296;   // (1<<32)
                                        val += buffer.getUint32(info.meta.pos+4, false);
                                        info.meta.pos += 8;
                                        var value = doubleprec(val);  
                                        value = parseFloat(value.toPrecision(5));
                                        /*
                                        if (info.meta.ispairvalue){
                                            info.meta.StringObject += ":";                               // for Debugging
                                        } 
                                        */
                                        var StrCh = StrChf();
                                        if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].typ == 'strictarray'){
                                            StrCh.push(value);  
                                        } else {
                                            StrCh[info.meta.pairkey] = value;
                                        }    
                                        info.meta.ispairvalue = false;
                                        //info.meta.StringObject += value.toString();                    // for Debugging
                                        info.meta.nexttype = true;
                                        end_of_metatag(buffer);
                                    } 

                                    if (info.meta.scriptdatavalue == 1){                                 // UI8 : boolean
                                        var value = true;
                                        if (buffer.getUint8(info.meta.pos) == 0) value = false;
                                        if (info.meta.ispairvalue){
                                            //info.meta.StringObject += ":";                             // for Debugging
                                            var StrCh = StrChf();
                                            if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].typ == 'strictarray'){
                                                StrCh.push(value);  
                                            } else {
                                                StrCh[info.meta.pairkey] = value;
                                            }    
                                            info.meta.ispairvalue = false;
                                        } /*
                                        if (value){
                                            info.meta.StringObject += "true";                            // for Debugging
                                        } else {
                                            info.meta.StringObject += "false";                           // for Debugging
                                        } */
                                        info.meta.pos += 1;
                                        info.meta.nexttype = true;
                                        end_of_metatag(buffer);
                                    }

                                    if ((info.meta.scriptdatavalue == 2) && info.meta.nexttag){          //SCRIPTDATASTRING
                                        var StrLength = buffer.getUint16(info.meta.pos, false);
                                        info.meta.pos += 2;
                                        var paramStr = litCar(buffer, info.meta.pos, StrLength);
                                        if ((info.meta.pos == buffpos+14) && (paramStr != 'onMetaData')){
                                            info.meta.pos = info.tag.datasize + buffpos + 11;
                                        } else {        
                                            info.meta.pos += StrLength;
                                            info.meta.nexttype = true;
                                            
                                            if (info.meta.ispairvalue){                                  // Is there one ":" before ?
                                                //info.meta.StringObject += ":";                         // for Debugging
                                                var StrCh = StrChf();
                                                if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].typ == 'strictarray'){
                                                    StrCh.push(paramStr);  
                                                } else {
                                                    StrCh[info.meta.pairkey] = paramStr;
                                                }    
                                            } else {
                                                info.meta.pairkey = paramStr;
                                            }
                                            //info.meta.StringObject += paramStr;                        // for Debugging 
                                            end_of_metatag(buffer); 
                                        }
                                    }

                                    if (info.meta.scriptdatavalue == 3){                                 //SCRIPTDATAOBJECT <=> current after onMetaData
                                        var level={level : info.meta.LevelsEnd.length, typ : 'object'};
                                        if (info.meta.LevelsEnd.length == 0){
                                            level["chaine"] = 'onMetaData';
                                        } else {
                                            level["chaine"] = info.meta.pairkey;
                                            var StrCh = StrChf();
                                            StrCh[info.meta.pairkey] = {};
                                        }
                                        info.meta.LevelsEnd.push(level);
                                        //info.meta.StringObject += "{";                                 // for Debugging
                                        info.meta.nexttype = false;
                                        info.meta.scriptdatavalue = 2;                                   // next param is a datastringtype !
                                        info.meta.ispairvalue = false;
                                    }

                                    if (info.meta.scriptdatavalue == 7){                                 //UI16
                                        var value = buffer.getUint16(info.meta.pos, false);
                                        if (info.meta.ispairvalue){
                                            //info.meta.StringObject += ":";                             // for Debugging
                                            var StrCh = StrChf();
                                            if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].typ == 'strictarray'){
                                                StrCh.push(value);  
                                            } else {
                                                StrCh[info.meta.pairkey] = value;
                                            }    
                                            info.meta.ispairvalue = false;
                                        }
                                        //info.meta.StringObject += value.toString();                    // for Debugging
                                        info.meta.pos += 2;
                                        info.meta.nexttype = true;
                                        end_of_metatag(buffer); 
                                    }

                                    if (info.meta.scriptdatavalue == 8){                                 //SCRIPTDATAECMAARRAY
                                        var dataLenght = buffer.getUint32(info.meta.pos, false);
                                        var level = {level : info.meta.LevelsEnd.length, typ : 'ecma_array'};
                                        if (info.meta.LevelsEnd.length == 0){
                                            level["chaine"] = 'onMetaData';
                                        } else {
                                            level["chaine"] = info.meta.pairkey;
                                            var StrCh = StrChf();
                                            StrCh[info.meta.pairkey] = {};
                                        }
                                        info.meta.LevelsEnd.push(level);
                                        //info.meta.StringObject += "{";                                 // for Debugging
                                        info.meta.nexttype = false;
                                        info.meta.scriptdatavalue = 2;                                   // next param is a datastringtype !
                                        info.meta.pos += 4;
                                        info.meta.ispairvalue = false;
                                    }

                                    if (info.meta.scriptdatavalue == 10){                                //SCRIPTDATASTRICTARRAY
                                        var datacount = buffer.getUint32(info.meta.pos, false);
                                        var level = {level : info.meta.LevelsEnd.length, count : datacount, typ : 'strictarray'};
                                        if (info.meta.LevelsEnd.length == 0){
                                            level["chaine"] = 'onMetaData';
                                        } else {
                                            level["chaine"] = info.meta.pairkey;
                                            var StrCh = StrChf();
                                            StrCh[info.meta.pairkey] = [];
                                        }
                                        info.meta.LevelsEnd.push(level);
                                        //info.meta.StringObject += "[" + datacount.toString() +"]{";   // for Debugging
                                        info.meta.pos += 4;
                                        info.meta.nexttype = true;
                                        info.meta.scriptdatavalue = 2;
                                        info.meta.ispairvalue = false;
                                    }

                                    if (info.meta.scriptdatavalue == 11){                                //SCRIPTDATADATE  : Don't need to decode !
                                        var dtms1 = buffer.getUint32(info.meta.pos, false);              // count of ms after 1/1/1970 at Greenwich
                                        var dtms2 = buffer.getUint32(info.meta.pos, false);              // count of ms after 1/1/1970 at Greenwich
                                        var ldmn = buffer.getUint16(info.meta.pos, false);
                                        if (ldmn > 32768) ldmn -= 65536; 
                                        var datestr = "date(" + dtms1.toString() + "," + dtms2.toString() + "," + ldmn.toString() + ")";
                                        if (info.meta.ispairvalue){
                                            //info.meta.StringObject += ":";                             // for Debugging
                                            var StrCh = StrChf();
                                            if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].typ == 'strictarray'){
                                                StrCh.push(datestr);  
                                            } else {
                                                StrCh[info.meta.pairkey] = datestr;
                                            }    
                                            info.meta.ispairvalue = false;
                                        }
                                        //info.meta.StringObject += datestr;                             // for Debugging
                                        info.meta.pos += 10;
                                        info.meta.nexttype = true;
                                        end_of_metatag(buffer); 
                                    }

                                    if (info.meta.scriptdatavalue == 12){                                //SCRIPTDATALONGSTRING
                                        var StrLength = buffer.getUint32(info.meta.pos, false);
                                        info.meta.pos += 4;
                                        var paramStr = litCar(buffer, info.meta.pos, StrLength);
                                        info.meta.pos += StrLength;
                                        info.meta.nexttype = true;
                                        if (info.meta.ispairvalue){
                                            //info.meta.StringObject += ":";                             // for Debugging
                                            var StrCh = StrChf();
                                            if (info.meta.LevelsEnd[info.meta.LevelsEnd.length-1].typ == 'strictarray'){
                                                StrCh.push(paramStr);  
                                            } else {
                                                StrCh[info.meta.pairkey] = paramStr;
                                            }    
                                        }
                                        //info.meta.StringObject += paramStr;                            // for Debugging
                                        end_of_metatag(buffer); 
                                    }

                                    if (!inArray(info.meta.scriptdatavalue, TabScriptsValue)){           // Else 
                                        info.parseMetaDataBREAK = true;
                                        info.meta.pos = info.tag.datasize + buffpos + 11;                // EXIT of parsing scriptdatavalue
                                    }

                                }                                                                        // endwhile (in FLVScript)

                                //info.tags.push(info.meta.StringObject);                                // Debugging : will be erased

                            } else {                                                                     //  endif (tagFLV) : buffer too small - Can't read all metadata ! So reload with a better offset 
                                if (buffpos + info.FileOffBuff < info.filesize){ 
                                    var newoffset = buffpos + info.FileOffBuff;   
                                    LoadBuffer(newoffset, suite);    
                                } else {                                                                 // Theorical : never met  but ... by caution ! Who knows ?
                                    delete info.tags;
                                    delete info.tag;
                                    delete info.meta;
                                    // verification factor 2 !!
                                    setFactor();
                                    suite(null, info);    
                                }    
                            }
                        }

                        if (!inArray(tagtype, FLVTags)){                                                 // Stop parse FLV Flags !!
                            info.parseFlagsBREAK = true;
                            buffpos = info.BuffLength;
                            info.FileOffBuff = info.filesize;
                        }

                        buffpos += 15 + info.tag.datasize;
                    }                                                                                    // EndWhile BuffPos + 15

                    if (buffpos + info.FileOffBuff < info.filesize){
                        var newoffset = buffpos + info.FileOffBuff;
                        LoadBuffer(newoffset, suite);    
                    } else {
                        delete info.tags;
                        delete info.tag;
                        delete info.meta;
                        // verification factor 2 !!
                        setFactor();
                        suite(null, info);
                    }
                }
            });
        }

        LoadBuffer(0, function(err){
            if (err){
                callback(err);
            } else {
                callback(null, info);
            }
        });
    }               // FLVTree.parse

        /*
         * Reader.js
         * A unified reader interface for AJAX, local and File API access
         * 43081j
         * License: MIT, see LICENSE
         */
    var Reader = function(type) {
        this.type = type || Reader.OPEN_URI;
        this.size = null;
        this.file = null;
    };

    Reader.OPEN_FILE = 1;
    Reader.OPEN_URI = 2;
    Reader.OPEN_LOCAL = 3;

    if (typeof require === 'function') {
        var fs = require('fs');
    }

    Reader.prototype.open = function(file, callback) {
        this.file = file;
        var self = this;
        switch (this.type) {
            case Reader.OPEN_LOCAL:
                fs.stat(this.file, function(err, stat) {
                    if (err) {
                        return callback(err);
                    }
                    self.size = stat.size;
                    fs.open(self.file, 'r', function(err, fd) {
                        if (err) {
                            return callback(err);
                        }
                        self.fd = fd;
                        callback();
                    });
                });
                break;
            case Reader.OPEN_FILE:
                this.size = this.file.size;
                callback();
                break;
            default:
                this.ajax({
                        uri: this.file,
                        type: 'HEAD',
                    },
                    function(err, resp, xhr) {
                        if (err) {
                            return callback(err);
                        }
                        self.size = parseInt(xhr.getResponseHeader('Content-Length'));
                        callback();
                    }
                );
                break;
        }
    };

    Reader.prototype.close = function() {
        if (this.type === Reader.OPEN_LOCAL) {
            fs.close(this.fd);
        }
    };

    Reader.prototype.read = function(length, position, callback) {
        if (typeof position === 'function') {
            callback = position;
            position = 0;
        }
        if (this.type === Reader.OPEN_LOCAL) {
            this.readLocal(length, position, callback);
        } else if (this.type === Reader.OPEN_FILE) {
            this.readFile(length, position, callback);
        } else {
            this.readUri(length, position, callback);
        }
    };

    Reader.prototype.readBlob = function(length, position, type, callback) {
        if (typeof position === 'function') {
            callback = position;
            position = 0;
        } else if (typeof type === 'function') {
            callback = type;
            type = 'application/octet-stream';
        }
        this.read(length, position, function(err, data) {
            if (err) {
                callback(err);
                return;
            }
            callback(null, new Blob([data], {
                type: type
            }));
        });
    };

    /*
     * Local reader
     */
    Reader.prototype.readLocal = function(length, position, callback) {
        var buffer = new Buffer(length);
        fs.read(this.fd, buffer, 0, length, position, function(err, bytesRead, buffer) {
            if (err) {
                return callback(err);
            }
            var ab = new ArrayBuffer(buffer.length),
                view = new Uint8Array(ab);
            for (var i = 0; i < buffer.length; i++) {
                view[i] = buffer[i];
            }
            callback(null, ab);
        });
    };

    /*
     * URL reader
     */
    Reader.prototype.ajax = function(opts, callback) {
        var options = {
            type: 'GET',
            uri: null,
            responseType: 'text'
        };
        if (typeof opts === 'string') {
            opts = {
                uri: opts
            };
        }
        for (var k in opts) {
            options[k] = opts[k];
        }
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            if (xhr.status !== 200 && xhr.status !== 206) {
                return callback('Received non-200/206 response (' + xhr.status + ')');
            }
            callback(null, xhr.response, xhr);
        };
        xhr.responseType = options.responseType;
        xhr.open(options.type, options.uri, true);
        if (options.range) {
            options.range = [].concat(options.range);
            if (options.range.length === 2) {
                xhr.setRequestHeader('Range', 'bytes=' + options.range[0] + '-' + options.range[1]);
            } else {
                xhr.setRequestHeader('Range', 'bytes=' + options.range[0]);
            }
        }
        xhr.send();
    };

    Reader.prototype.readUri = function(length, position, callback) {
        this.ajax({
                uri: this.file,
                type: 'GET',
                responseType: 'arraybuffer',
                range: [position, position + length - 1]
            },
            function(err, buffer) {
                if (err) {
                    return callback(err);
                }
                return callback(null, buffer);
            }
        );
    };

    /*
     * File API reader
     */
    Reader.prototype.readFile = function(length, position, callback) {
    /*      OK in wekWorkers (OK for Chrome, Opera and IE) except Firefox  :
    /*                       http://stackoverflow.com/questions/22741478/firefox-filereader-is-not-defined-only-when-called-from-web-worker     */    
        if (typeof FileReader === 'undefined'){
            var slice = this.file.slice(position, position + length),
                fr=new FileReaderSync();
            callback(null,fr.readAsArrayBuffer(slice));
        } else {    
            var slice = this.file.slice(position, position + length),
               fr = new FileReader();
            fr.onload = function(e) {
                callback(null, e.target.result);
            };
            fr.readAsArrayBuffer(slice);
        }
    };
    /*
     * Read the file
     */

    if (typeof options.type === 'string') {
        switch (options.type) {
            case 'file':
                options.type = Reader.OPEN_FILE;
                break;
            case 'local':
                options.type = Reader.OPEN_LOCAL;
                break;
            default:
                options.type = Reader.OPEN_URI
        }
    }

    var handle = new Reader(options.type);

    handle.open(options.file, function(err) {
        if (err) {
            return flvcb('Could not open specified file');
        }
        FLVTree.parse(handle, function(err, tags) {
            flvcb(err, tags);
        });
    });
}; // var flv



if (typeof module !== 'undefined' && module.exports) {
    module.exports = flv;
} else {
    if (typeof define === 'function' && define.amd) {
        define('flv', [], function() {
            return flv;
        });
    } 
};