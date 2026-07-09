<?PHP 
function encrypt($data_input){
    $encryption_key = "igrapixkey1";
    // Store the cipher method 
    $ciphering = "AES-128-CTR"; 
    // Use OpenSSl Encryption method 
    $options = 0; 
    // Non-NULL Initialization Vector for encryption 
    $encryption_iv = '1234567891011121'; 
    $encryption = openssl_encrypt($data_input, $ciphering, 
                $encryption_key, $options, $encryption_iv); 
    return $encryption;
}
function decrypt($encoded_64){ 
	$encryption_key = "igrapixkey1";// same as you used to encrypt
	// Store the cipher method 
	$ciphering = "AES-128-CTR"; 
	// Use OpenSSl Encryption method 
	$options = 0; 
	$decryption_iv = '1234567891011121';  
	// Use openssl_decrypt() function to decrypt the data 
	$decryption=openssl_decrypt ($encoded_64, $ciphering,  
			$encryption_key, $options, $decryption_iv); 
	return $decryption;
}

?>