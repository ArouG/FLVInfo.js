#FLVInfo.js 

   Sort of "Mediainfo" for FLV Files - little FLVParser (just for main technics information about the file)

#Dependances : null

#Usage :

    <script src="FLVInfo.js" type="text/javascript" charset="utf-8"></script> <-- or FLVInfo_min.js -->
    (in single file .html)

    importScripts('FLVInfo.js');                                              <-- or FLVInfo_min.js -->                                        
    (in worker)


#How use it :

     
            flv(this.files[0], function(err, info) {
                if (err) {
                    .....
                } else {
                    sortie_texte = human_reading(info);
                    ....
                }
            }); 

  FLVInfo return an object structured (named 'info') wich contains a lot of technicals information about the file.
  If we want to read this informations, we need to make them readable. So human_reading is here !
  Try with short files because FLV parse the totality of the file. So, more big is the fie, more time to do the job !

#Examples :
	
	for a single file and no worker : index.html
	for multiple files and worker   : indexw.html

#Try it ? 
    http://aroug.eu/FLVInfo/   (multiple + worker + use FLVInfo.min.js)    
