#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/err.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <string.h>

static char LAST_ERROR[256] = "";

static void set_last_error(const char *msg) {
  strncpy(LAST_ERROR, msg, sizeof(LAST_ERROR) - 1);
  LAST_ERROR[sizeof(LAST_ERROR) - 1] = '\0';
}

const char *wasm_get_last_error(void) {
  return LAST_ERROR;
}

int wasm_random_bytes(unsigned char *buffer, int length) {
  if (RAND_bytes(buffer, length) != 1) {
    unsigned long err = ERR_get_error();
    const char *msg = ERR_reason_error_string(err);
    if (msg == NULL) {
      msg = "RAND_bytes failed";
    }
    set_last_error(msg);
    return 0;
  }
  return 1;
}

int wasm_sha256(const unsigned char *data, int length, unsigned char *out_digest) {
  EVP_MD_CTX *ctx = EVP_MD_CTX_new();
  if (ctx == NULL) {
    set_last_error("Failed to allocate EVP_MD_CTX");
    return 0;
  }

  const EVP_MD *sha256 = EVP_sha256();
  if (sha256 == NULL) {
    EVP_MD_CTX_free(ctx);
    set_last_error("EVP_sha256 not available");
    return 0;
  }

  if (EVP_DigestInit_ex(ctx, sha256, NULL) != 1) {
    EVP_MD_CTX_free(ctx);
    set_last_error("EVP_DigestInit_ex failed");
    return 0;
  }

  if (EVP_DigestUpdate(ctx, data, length) != 1) {
    EVP_MD_CTX_free(ctx);
    set_last_error("EVP_DigestUpdate failed");
    return 0;
  }

  unsigned int digest_len = 0;
  if (EVP_DigestFinal_ex(ctx, out_digest, &digest_len) != 1) {
    EVP_MD_CTX_free(ctx);
    set_last_error("EVP_DigestFinal_ex failed");
    return 0;
  }

  EVP_MD_CTX_free(ctx);
  return (int)digest_len;
}

static BIO *create_b64_bio(void) {
  BIO *bio = BIO_new(BIO_f_base64());
  if (bio == NULL) {
    set_last_error("BIO_new failed");
    return NULL;
  }
  BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL);
  return bio;
}

int wasm_base64_encode(const unsigned char *data, int length, char *out, int out_size) {
  BIO *bio = NULL;
  BIO *b64 = create_b64_bio();
  if (b64 == NULL) {
    return 0;
  }

  BIO *mem = BIO_new(BIO_s_mem());
  if (mem == NULL) {
    BIO_free_all(b64);
    set_last_error("BIO_new (mem) failed");
    return 0;
  }

  bio = BIO_push(b64, mem);
  if (BIO_write(bio, data, length) <= 0 || BIO_flush(bio) != 1) {
    BIO_free_all(bio);
    set_last_error("BIO_write/BIO_flush failed");
    return 0;
  }

  BUF_MEM *buffer_ptr = NULL;
  BIO_get_mem_ptr(bio, &buffer_ptr);
  if (buffer_ptr == NULL || buffer_ptr->data == NULL) {
    BIO_free_all(bio);
    set_last_error("BIO_get_mem_ptr failed");
    return 0;
  }

  int required = (int)buffer_ptr->length;
  if (required + 1 > out_size) {
    BIO_free_all(bio);
    set_last_error("Output buffer too small");
    return 0;
  }

  memcpy(out, buffer_ptr->data, required);
  out[required] = '\0';
  BIO_free_all(bio);
  return required;
}

int wasm_base64_decode(const char *input, unsigned char *out, int out_size) {
  BIO *b64 = create_b64_bio();
  if (b64 == NULL) {
    return 0;
  }

  BIO *mem = BIO_new_mem_buf((void *)input, -1);
  if (mem == NULL) {
    BIO_free_all(b64);
    set_last_error("BIO_new_mem_buf failed");
    return 0;
  }

  BIO *bio = BIO_push(b64, mem);
  int decoded_len = BIO_read(bio, out, out_size);
  if (decoded_len <= 0) {
    BIO_free_all(bio);
    set_last_error("BIO_read failed or output buffer too small");
    return 0;
  }

  BIO_free_all(bio);
  return decoded_len;
}

__attribute__((constructor)) static void wasm_openssl_init(void) {
  ERR_load_crypto_strings();
  OpenSSL_add_all_algorithms();
}

__attribute__((destructor)) static void wasm_openssl_cleanup(void) {
  EVP_cleanup();
  ERR_free_strings();
}