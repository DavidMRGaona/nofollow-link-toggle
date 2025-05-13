<?php
/**
 * Plugin Name: Nofollow Link Toggle
 * Description: Adds an option to mark links as nofollow in the WordPress classic editor.
 * Version: 1.0.0
 * Author: David M. Ramos
 * Author URI: https://davidmramos.com
 * Text Domain: nofollow-link-toggle
 * Domain Path: /languages
 *
 * @package Nofollow_Link_Toggle
 */

/**
 * Initialize the plugin and load text domain for translations
 *
 * @return void
 */
function nlt_init() {
	// Load plugin text domain for translations
	load_plugin_textdomain(
		'nofollow-link-toggle',
		false,
		dirname( plugin_basename( __FILE__ ) ) . '/languages'
	);
}
add_action( 'plugins_loaded', 'nlt_init' );

/**
 * Register our TinyMCE plugin that handles the nofollow link toggle functionality.
 * This adds the script as a TinyMCE plugin, which is the proper way to extend the editor.
 *
 * @param array $plugins Array of TinyMCE plugins.
 * @return array Modified array of TinyMCE plugins.
 */
function nlt_add_tinymce_plugin( $plugins ) {
	$plugins['nofollow_link_toggle'] = plugin_dir_url( __FILE__ ) . 'editor.js';
	return $plugins;
}
add_filter( 'mce_external_plugins', 'nlt_add_tinymce_plugin' );

/**
 * Enqueue the script for the WordPress admin to handle the link dialog modifications.
 * This ensures our script is available for both visual and text editor modes.
 *
 * @return void
 */
function nlt_enqueue_admin_script() {
	// Only load on post-edit screens.
	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->base, array( 'post', 'page' ), true ) ) {
		return;
	}
	
	wp_enqueue_script(
		'nlt-admin-script',
		plugin_dir_url( __FILE__ ) . 'editor.js',
		array( 'jquery', 'wp-api-fetch' ),
		filemtime( plugin_dir_path( __FILE__ ) . 'editor.js' ),
		true
	);
	
	// Localize the script with translation strings.
	wp_localize_script(
		'nlt-admin-script',
		'nltOptions',
		array(
			'addNofollowText'  => __( 'Add "nofollow" attribute to link', 'nofollow-link-toggle' ),
			'failedToInsertUI' => __( 'Nofollow Link Toggle: Failed to insert UI', 'nofollow-link-toggle' ),
		)
	);
}
add_action( 'admin_enqueue_scripts', 'nlt_enqueue_admin_script' );
